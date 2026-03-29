import { Router } from "express";
import crypto from "crypto";
import prisma from "../db.js";
import { authenticated } from "../middleware/auth.js";
import {
  exchangeCodeForTokens,
  getFitbitSleepData,
  getFitbitActivityData,
  getFitbitHeartRateData,
  buildWeeklySummary,
  getMonday,
  computeWeeklyEnrichments,
} from "../lib/fitbit-api.js";

const router = Router();

const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_REDIRECT_URI = process.env.FITBIT_REDIRECT_URI;
const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";

// In-memory store for OAuth state parameters (userId -> state, with TTL)
const oauthStateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of oauthStateStore) {
    if (now > entry.expiry) {
      oauthStateStore.delete(state);
    }
  }
}

// GET /api/fitbit/auth-url — Generate Fitbit OAuth authorization URL
router.get("/auth-url", authenticated, (req, res) => {
  cleanExpiredStates();

  const state = crypto.randomUUID();
  oauthStateStore.set(state, {
    userId: req.user.id,
    expiry: Date.now() + STATE_TTL_MS,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: FITBIT_CLIENT_ID,
    redirect_uri: FITBIT_REDIRECT_URI,
    scope: "sleep activity heartrate",
    state,
  });

  res.json({ url: `${FITBIT_AUTH_URL}?${params.toString()}` });
});

// GET /api/fitbit/callback — Handle Fitbit OAuth redirect (public endpoint)
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect("momentum://fitbit/error?reason=missing_params");
  }

  const stateEntry = oauthStateStore.get(state);
  oauthStateStore.delete(state);

  if (!stateEntry || Date.now() > stateEntry.expiry) {
    return res.redirect("momentum://fitbit/error?reason=invalid_state");
  }

  const { userId } = stateEntry;

  try {
    const tokenData = await exchangeCodeForTokens(code, FITBIT_REDIRECT_URI);

    await prisma.fitbitToken.upsert({
      where: { userId },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        fitbitUserId: tokenData.user_id,
        scope: tokenData.scope || "sleep",
      },
      create: {
        userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        fitbitUserId: tokenData.user_id,
        scope: tokenData.scope || "sleep",
      },
    });

    res.redirect("momentum://fitbit/connected");
  } catch (error) {
    console.error("Fitbit callback error:", error);
    res.redirect("momentum://fitbit/error?reason=token_exchange_failed");
  }
});

// GET /api/fitbit/status — Check if user has Fitbit connected
router.get("/status", authenticated, async (req, res) => {
  try {
    const fitbitToken = await prisma.fitbitToken.findUnique({
      where: { userId: req.user.id },
    });

    if (fitbitToken) {
      res.json({ connected: true, fitbitUserId: fitbitToken.fitbitUserId });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    console.error("Fitbit status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/fitbit/disconnect — Remove Fitbit connection
router.delete("/disconnect", authenticated, async (req, res) => {
  try {
    await prisma.fitbitToken.delete({
      where: { userId: req.user.id },
    });

    res.json({ disconnected: true });
  } catch (error) {
    if (error.code === "P2025") {
      return res.json({ disconnected: true });
    }
    console.error("Fitbit disconnect error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fitbit/sleep/:date — Fetch sleep data for a specific date
router.get("/sleep/:date", authenticated, async (req, res) => {
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    const sleepData = await getFitbitSleepData(req.user.id, date);
    res.json(sleepData);
  } catch (error) {
    if (error.message === "FITBIT_NOT_CONNECTED") {
      return res.status(401).json({ error: "Fitbit not connected" });
    }
    if (error.message === "FITBIT_REAUTH_REQUIRED") {
      return res
        .status(401)
        .json({ error: "Fitbit re-authentication required" });
    }
    if (error.message === "FITBIT_API_ERROR") {
      return res
        .status(502)
        .json({ error: "Failed to fetch sleep data from Fitbit" });
    }
    console.error("Sleep data error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fitbit/activity/:date — Fetch activity data for a specific date
router.get("/activity/:date", authenticated, async (req, res) => {
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    const activityData = await getFitbitActivityData(req.user.id, date);
    res.json(activityData);
  } catch (error) {
    if (error.message === "FITBIT_NOT_CONNECTED") {
      return res.status(401).json({ error: "Fitbit not connected" });
    }
    if (error.message === "FITBIT_REAUTH_REQUIRED") {
      return res
        .status(401)
        .json({ error: "Fitbit re-authentication required" });
    }
    if (error.message === "FITBIT_API_ERROR") {
      return res
        .status(502)
        .json({ error: "Failed to fetch activity data from Fitbit" });
    }
    console.error("Activity data error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// In-memory cache for weekly summaries
export const weeklySummaryCache = new Map();
const WEEKLY_CACHE_TTL_CURRENT = 10 * 60 * 1000; // 10 minutes for current week
const WEEKLY_CACHE_TTL_PAST = 60 * 60 * 1000; // 60 minutes for past weeks

function cleanExpiredWeeklyCache() {
  const now = Date.now();
  for (const [key, entry] of weeklySummaryCache) {
    if (now > entry.expiry) {
      weeklySummaryCache.delete(key);
    }
  }
}

// GET /api/fitbit/weekly-summary — Fetch weekly activity summary (Mon-Sun)
router.get("/weekly-summary", authenticated, async (req, res) => {
  const weekOf = req.query.weekOf || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    const monday = getMonday(weekOf);
    const sundayDate = new Date(monday + "T00:00:00Z");
    sundayDate.setUTCDate(sundayDate.getUTCDate() + 6);
    const sunday = `${sundayDate.getUTCFullYear()}-${String(sundayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(sundayDate.getUTCDate()).padStart(2, "0")}`;

    // Check cache
    cleanExpiredWeeklyCache();
    const cacheKey = `weekly:${req.user.id}:${monday}`;
    const cached = weeklySummaryCache.get(cacheKey);
    if (cached) {
      return res.json(cached.data);
    }

    // Fetch current week and previous week in parallel
    const prevMondayDate = new Date(monday + "T00:00:00Z");
    prevMondayDate.setUTCDate(prevMondayDate.getUTCDate() - 7);
    const prevMonday = `${prevMondayDate.getUTCFullYear()}-${String(prevMondayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(prevMondayDate.getUTCDate()).padStart(2, "0")}`;
    const prevSundayDate = new Date(prevMondayDate);
    prevSundayDate.setUTCDate(prevSundayDate.getUTCDate() + 6);
    const prevSunday = `${prevSundayDate.getUTCFullYear()}-${String(prevSundayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(prevSundayDate.getUTCDate()).padStart(2, "0")}`;

    const [summary, prevResult] = await Promise.all([
      buildWeeklySummary(req.user.id, monday, sunday),
      buildWeeklySummary(req.user.id, prevMonday, prevSunday).catch(() => null),
    ]);

    const previousWeekStats = prevResult ? prevResult.weeklyStats : null;
    const enrichments = computeWeeklyEnrichments(
      summary.days,
      summary.weeklyStats,
      previousWeekStats,
    );

    const enrichedSummary = { ...summary, ...enrichments };

    // Cache with appropriate TTL
    const ttl = summary.hasPartialData
      ? WEEKLY_CACHE_TTL_CURRENT
      : WEEKLY_CACHE_TTL_PAST;
    weeklySummaryCache.set(cacheKey, {
      data: enrichedSummary,
      expiry: Date.now() + ttl,
    });

    res.json(enrichedSummary);
  } catch (error) {
    if (error.message === "FITBIT_NOT_CONNECTED") {
      return res.status(401).json({ error: "Fitbit not connected" });
    }
    if (error.message === "FITBIT_REAUTH_REQUIRED") {
      return res
        .status(401)
        .json({ error: "Fitbit re-authentication required" });
    }
    if (error.message === "FITBIT_API_ERROR") {
      return res
        .status(502)
        .json({ error: "Failed to fetch weekly summary from Fitbit" });
    }
    console.error("Weekly summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fitbit/heartrate/:date — Fetch heart rate data for a specific date
router.get("/heartrate/:date", authenticated, async (req, res) => {
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    const heartRateData = await getFitbitHeartRateData(req.user.id, date);
    res.json(heartRateData);
  } catch (error) {
    if (error.message === "FITBIT_NOT_CONNECTED") {
      return res.status(401).json({ error: "Fitbit not connected" });
    }
    if (error.message === "FITBIT_REAUTH_REQUIRED") {
      return res
        .status(401)
        .json({ error: "Fitbit re-authentication required" });
    }
    if (error.message === "FITBIT_API_ERROR") {
      return res
        .status(502)
        .json({ error: "Failed to fetch heart rate data from Fitbit" });
    }
    console.error("Heart rate data error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
