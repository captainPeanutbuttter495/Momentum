import { Router } from "express";
import prisma from "../db.js";
import { authenticated, requireUser } from "../middleware/auth.js";
import {
  getFitbitSleepData,
  getFitbitActivityData,
  getFitbitHeartRateData,
} from "../lib/fitbit-api.js";
import { getCoachInsight } from "../lib/coach.js";
import { buildWorkoutSummary, buildExerciseProgressions } from "../lib/training-analysis.js";

const router = Router();

// In-memory cache: key = "userId:date:context", value = { message, timestamp }
export const insightCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(userId, date, context) {
  return `${userId}:${date}:${context}`;
}

function getDateOffset(dateStr, daysBack) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().split("T")[0];
}

function getCachedInsight(userId, date, context) {
  const key = getCacheKey(userId, date, context);
  const cached = insightCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.message;
  }
  if (cached) insightCache.delete(key);
  return null;
}

function setCachedInsight(userId, date, context, message) {
  const key = getCacheKey(userId, date, context);
  insightCache.set(key, { message, timestamp: Date.now() });
}

// POST /api/coach/insight
router.post("/insight", authenticated, requireUser, async (req, res) => {
  const { context, date } = req.body;

  if (!["morning", "recap"].includes(context)) {
    return res.status(400).json({ error: "context must be 'morning' or 'recap'" });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    // Check cache first
    const cached = getCachedInsight(req.user.id, date, context);
    if (cached) {
      return res.json(cached);
    }

    // Fetch user profile
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id },
    });

    // Fetch health data in parallel based on context
    // Also fetch yesterday's data for comparison
    const yesterdayDate = getDateOffset(date, 1);
    let sleep = null;
    let activity = null;
    let heartRate = null;
    let yesterdaySleep = null;
    let yesterdayActivity = null;
    let yesterdayHeartRate = null;

    if (context === "morning") {
      const results = await Promise.allSettled([
        getFitbitSleepData(req.user.id, date),
        getFitbitHeartRateData(req.user.id, date),
        getFitbitSleepData(req.user.id, yesterdayDate),
        getFitbitHeartRateData(req.user.id, yesterdayDate),
      ]);
      sleep = results[0].status === "fulfilled" ? results[0].value : null;
      heartRate = results[1].status === "fulfilled" ? results[1].value : null;
      yesterdaySleep = results[2].status === "fulfilled" ? results[2].value : null;
      yesterdayHeartRate = results[3].status === "fulfilled" ? results[3].value : null;
    } else {
      const results = await Promise.allSettled([
        getFitbitSleepData(req.user.id, date),
        getFitbitActivityData(req.user.id, date),
        getFitbitHeartRateData(req.user.id, date),
        getFitbitSleepData(req.user.id, yesterdayDate),
        getFitbitActivityData(req.user.id, yesterdayDate),
        getFitbitHeartRateData(req.user.id, yesterdayDate),
      ]);
      sleep = results[0].status === "fulfilled" ? results[0].value : null;
      activity = results[1].status === "fulfilled" ? results[1].value : null;
      heartRate = results[2].status === "fulfilled" ? results[2].value : null;
      yesterdaySleep = results[3].status === "fulfilled" ? results[3].value : null;
      yesterdayActivity = results[4].status === "fulfilled" ? results[4].value : null;
      yesterdayHeartRate = results[5].status === "fulfilled" ? results[5].value : null;
    }

    // Fetch manual workout logs for recap context
    let workoutLogs = null;
    let recentWorkouts = null;

    if (context === "recap") {
      try {
        const [logsResult, historyResult] = await Promise.allSettled([
          prisma.workoutLog.findMany({
            where: { userId: req.user.id, date },
            include: { exercises: { orderBy: { position: "asc" } } },
          }),
          prisma.workoutLog.findMany({
            where: {
              userId: req.user.id,
              date: {
                gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              },
            },
            include: { exercises: { orderBy: { position: "asc" } } },
            orderBy: { date: "desc" },
          }),
        ]);
        const logs = logsResult.status === "fulfilled" ? logsResult.value : [];
        const history = historyResult.status === "fulfilled" ? historyResult.value : [];
        workoutLogs = logs.length > 0 ? logs : null;
        recentWorkouts = history.length > 0 ? history : null;
      } catch {
        // Workout log fetch is non-critical; continue without it
      }
    }

    // Bundle yesterday's data (null if all fetches failed)
    const yesterday = (yesterdaySleep || yesterdayHeartRate || yesterdayActivity)
      ? { sleep: yesterdaySleep, heartRate: yesterdayHeartRate, activity: yesterdayActivity }
      : null;

    // Compute derived workout analysis (pure functions, recap only)
    const workoutSummary = context === "recap"
      ? buildWorkoutSummary(activity, workoutLogs)
      : null;
    const exerciseProgressions = context === "recap"
      ? buildExerciseProgressions(recentWorkouts)
      : null;

    const insight = await getCoachInsight({
      context,
      date,
      profile,
      sleep,
      activity,
      heartRate,
      userName: req.user.name,
      workoutLogs,
      recentWorkouts,
      yesterday,
      workoutSummary,
      exerciseProgressions,
    });

    const responseData = { ...insight, context, date };

    // Cache the response
    setCachedInsight(req.user.id, date, context, responseData);

    res.json(responseData);
  } catch (error) {
    if (error.message === "FITBIT_NOT_CONNECTED") {
      return res.status(401).json({ error: "Fitbit not connected" });
    }
    if (error.message === "FITBIT_REAUTH_REQUIRED") {
      return res.status(401).json({ error: "Fitbit re-authentication required" });
    }
    console.error("Coach insight error:", error);
    res.status(500).json({ error: "Failed to generate coaching insight" });
  }
});

export default router;
