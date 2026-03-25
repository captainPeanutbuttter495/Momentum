import prisma from "../db.js";

const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";

function getBasicAuthHeader() {
  const credentials = Buffer.from(
    `${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

// Refresh the Fitbit access token if expired or expiring within 5 minutes
export async function refreshFitbitTokenIfNeeded(fitbitToken) {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (fitbitToken.expiresAt > fiveMinutesFromNow) {
    return fitbitToken;
  }

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: fitbitToken.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Fitbit token refresh failed:", error);
    throw new Error("FITBIT_REAUTH_REQUIRED");
  }

  const data = await response.json();

  const updated = await prisma.fitbitToken.update({
    where: { id: fitbitToken.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return updated;
}

// Exchange an authorization code for Fitbit tokens
export async function exchangeCodeForTokens(code, redirectUri) {
  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Fitbit token exchange failed:", error);
    throw new Error("TOKEN_EXCHANGE_FAILED");
  }

  return response.json();
}

// Helper to get a valid Fitbit token for a user
async function getValidToken(userId) {
  const fitbitToken = await prisma.fitbitToken.findUnique({
    where: { userId },
  });

  if (!fitbitToken) {
    throw new Error("FITBIT_NOT_CONNECTED");
  }

  return refreshFitbitTokenIfNeeded(fitbitToken);
}

// Helper to make authenticated Fitbit API requests
async function fitbitFetch(token, url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Fitbit API error:", error);
    throw new Error("FITBIT_API_ERROR");
  }

  return response.json();
}

// Fetch sleep data from Fitbit API for a given date
export async function getFitbitSleepData(userId, date) {
  const token = await getValidToken(userId);
  const data = await fitbitFetch(
    token,
    `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`,
  );

  // Transform Fitbit response into a clean shape
  const summary = data.summary || {};
  const sleepLog = (data.sleep || []).map((entry) => ({
    startTime: entry.startTime,
    endTime: entry.endTime,
    duration: entry.duration,
    efficiency: entry.efficiency,
    levels: entry.levels
      ? {
          data: entry.levels.data || [],
          summary: entry.levels.summary || {},
        }
      : null,
  }));

  return {
    date,
    summary: {
      totalMinutesAsleep: summary.totalMinutesAsleep || 0,
      totalTimeInBed: summary.totalTimeInBed || 0,
      stages: summary.stages || { deep: 0, light: 0, rem: 0, wake: 0 },
    },
    sleepLog,
  };
}

// Fetch activity data (steps, distance) from Fitbit API for a given date
export async function getFitbitActivityData(userId, date) {
  const token = await getValidToken(userId);

  // Fetch daily summary (steps, distance, calories) and activity log list (workouts) in parallel
  // Activity Log List API only accepts ONE of afterDate/beforeDate, so use afterDate and filter
  const [summaryData, logData] = await Promise.all([
    fitbitFetch(
      token,
      `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
    ),
    fitbitFetch(
      token,
      `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${date}&sort=asc&offset=0&limit=10`,
    ),
  ]);

  const summary = summaryData.summary || {};

  // Filter log results to only include workouts from the requested date
  const workoutLogs = (logData.activities || [])
    .filter((a) => {
      const logDate = a.startTime
        ? a.startTime.slice(0, 10)
        : a.originalStartTime
          ? a.originalStartTime.slice(0, 10)
          : null;
      return logDate === date;
    })
    .map((a) => ({
      name: a.activityName || a.name || "Workout",
      calories: a.calories || 0,
      duration: a.activeDuration || a.duration || 0,
      startTime: a.startTime || null,
      steps: a.steps || 0,
      heartRateZones: (a.heartRateZones || []).map((z) => ({
        name: z.name,
        min: z.min,
        max: z.max,
        minutes: z.minutes || 0,
        caloriesOut: z.caloriesOut || 0,
      })),
      averageHeartRate: a.averageHeartRate || null,
    }));

  return {
    date,
    steps: summary.steps || 0,
    distance: summary.distances
      ? summary.distances.find((d) => d.activity === "total")?.distance || 0
      : 0,
    caloriesOut: summary.caloriesOut || 0,
    activeMinutes: {
      sedentary: summary.sedentaryMinutes || 0,
      lightlyActive: summary.lightlyActiveMinutes || 0,
      fairlyActive: summary.fairlyActiveMinutes || 0,
      veryActive: summary.veryActiveMinutes || 0,
    },
    workouts: workoutLogs,
  };
}

// Fetch heart rate data from Fitbit API for a given date
export async function getFitbitHeartRateData(userId, date) {
  const token = await getValidToken(userId);
  const data = await fitbitFetch(
    token,
    `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`,
  );

  const heartData = data["activities-heart"]?.[0]?.value || {};
  return {
    date,
    restingHeartRate: heartData.restingHeartRate || null,
    zones: (heartData.heartRateZones || []).map((zone) => ({
      name: zone.name,
      min: zone.min,
      max: zone.max,
      minutes: zone.minutes || 0,
      caloriesOut: zone.caloriesOut || 0,
    })),
  };
}
