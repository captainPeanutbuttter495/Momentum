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

// Fetch activity history for a date range (single API call for running progressions)
export async function getFitbitActivityHistory(userId, startDate, endDate) {
  const token = await getValidToken(userId);
  const logData = await fitbitFetch(
    token,
    `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${startDate}&sort=asc&offset=0&limit=100`,
  );

  const workouts = (logData.activities || [])
    .filter((a) => {
      const logDate = a.startTime
        ? a.startTime.slice(0, 10)
        : a.originalStartTime
          ? a.originalStartTime.slice(0, 10)
          : null;
      return logDate && logDate >= startDate && logDate <= endDate;
    })
    .map((a) => ({
      name: a.activityName || a.name || "Workout",
      calories: a.calories || 0,
      duration: a.activeDuration || a.duration || 0,
      startTime: a.startTime || null,
      steps: a.steps || 0,
      distance: a.distance || 0,
      heartRateZones: (a.heartRateZones || []).map((z) => ({
        name: z.name,
        min: z.min,
        max: z.max,
        minutes: z.minutes || 0,
        caloriesOut: z.caloriesOut || 0,
      })),
      averageHeartRate: a.averageHeartRate || null,
    }));

  // Group by date
  const byDate = new Map();
  for (const w of workouts) {
    const d = w.startTime?.slice(0, 10);
    if (!d) continue;
    if (!byDate.has(d)) byDate.set(d, { date: d, workouts: [] });
    byDate.get(d).workouts.push(w);
  }

  return [...byDate.values()];
}

// Fetch a Fitbit time series for a date range (e.g. steps, calories, minutesFairlyActive)
// Returns array of { dateTime, value } or null on failure
export async function getFitbitTimeSeries(userId, resourcePath, startDate, endDate) {
  const token = await getValidToken(userId);
  const data = await fitbitFetch(
    token,
    `https://api.fitbit.com/1/user/-/activities/${resourcePath}/date/${startDate}/${endDate}.json`,
  );
  return data[`activities-${resourcePath}`] || [];
}

// Fetch raw weekly data: 5 parallel Fitbit API calls (4 time series + 1 activity history)
// Returns raw arrays — use buildWeeklySummary() to assemble the final response
async function getWeeklySummaryData(userId, startDate, endDate) {
  const results = await Promise.allSettled([
    getFitbitTimeSeries(userId, "steps", startDate, endDate),
    getFitbitTimeSeries(userId, "calories", startDate, endDate),
    getFitbitTimeSeries(userId, "minutesFairlyActive", startDate, endDate),
    getFitbitTimeSeries(userId, "minutesVeryActive", startDate, endDate),
    getFitbitActivityHistory(userId, startDate, endDate),
  ]);

  return {
    steps: results[0].status === "fulfilled" ? results[0].value : null,
    calories: results[1].status === "fulfilled" ? results[1].value : null,
    fairlyActive: results[2].status === "fulfilled" ? results[2].value : null,
    veryActive: results[3].status === "fulfilled" ? results[3].value : null,
    activityHistory: results[4].status === "fulfilled" ? results[4].value : [],
  };
}

// Helper to look up a time series value for a specific date, returns number or null
function timeSeriesValue(series, date) {
  if (!series) return null;
  const entry = series.find((e) => e.dateTime === date);
  if (!entry) return null;
  const val = parseInt(entry.value, 10);
  return Number.isNaN(val) ? null : val;
}

// Compute Monday of the week containing the given date string (YYYY-MM-DD)
export function getMonday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${dd}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Shared helper: builds the full normalized weekly summary object
// Called by both GET /api/fitbit/weekly-summary and POST /api/coach/weekly-insight
export async function buildWeeklySummary(userId, monday, sunday) {
  const raw = await getWeeklySummaryData(userId, monday, sunday);

  // Build workout lookup by date from activity history
  const workoutsByDate = new Map();
  for (const dayEntry of raw.activityHistory) {
    workoutsByDate.set(
      dayEntry.date,
      dayEntry.workouts.map((w) => ({
        name: w.name,
        durationMin: Math.round((w.duration || 0) / 60000),
        calories: w.calories || 0,
      })),
    );
  }

  // Determine today in YYYY-MM-DD
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Build 7 day objects (Mon-Sun)
  const days = [];
  const mondayDate = new Date(monday + "T00:00:00Z");

  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const dayOfWeek = DAY_NAMES[d.getUTCDay()];

    let status;
    if (dateStr > today) {
      status = "future";
    } else if (dateStr === today) {
      status = "today";
    } else {
      status = "complete";
    }

    const steps = status === "future" ? null : timeSeriesValue(raw.steps, dateStr);
    const caloriesOut = status === "future" ? null : timeSeriesValue(raw.calories, dateStr);
    const fairly = status === "future" ? null : timeSeriesValue(raw.fairlyActive, dateStr);
    const very = status === "future" ? null : timeSeriesValue(raw.veryActive, dateStr);
    const activeMinutes =
      fairly !== null && very !== null
        ? fairly + very
        : fairly !== null
          ? fairly
          : very !== null
            ? very
            : null;

    days.push({
      date: dateStr,
      dayOfWeek,
      status,
      steps,
      caloriesOut,
      activeMinutes,
      workouts: workoutsByDate.get(dateStr) || [],
    });
  }

  // Compute weeklyStats over completed/today days with non-null data
  const dataDays = days.filter(
    (d) => (d.status === "complete" || d.status === "today") && d.steps !== null,
  );
  const completedDays = dataDays.length;

  const totalSteps = dataDays.reduce((sum, d) => sum + d.steps, 0);
  const totalCalories = dataDays
    .filter((d) => d.caloriesOut !== null)
    .reduce((sum, d) => sum + d.caloriesOut, 0);
  const calorieDays = dataDays.filter((d) => d.caloriesOut !== null).length;
  const totalActiveMinutes = dataDays
    .filter((d) => d.activeMinutes !== null)
    .reduce((sum, d) => sum + d.activeMinutes, 0);

  const workoutCount = days.reduce((sum, d) => sum + d.workouts.length, 0);
  const daysWithWorkouts = days.filter((d) => d.workouts.length > 0).length;
  const daysOver8kSteps = dataDays.filter((d) => d.steps >= 8000).length;

  // bestDay: highest steps among "complete" days only (excludes today)
  const completeDaysOnly = dataDays.filter((d) => d.status === "complete");
  let bestDay = null;
  for (const d of completeDaysOnly) {
    if (!bestDay || d.steps > bestDay.steps) {
      bestDay = { date: d.date, dayOfWeek: d.dayOfWeek, steps: d.steps };
    }
  }

  // mostRecentCompleteDay: latest "complete" day with non-null steps
  const mostRecentCompleteDay =
    completeDaysOnly.length > 0
      ? completeDaysOnly[completeDaysOnly.length - 1].date
      : null;

  const hasPartialData = days.some((d) => d.status === "today");

  const weeklyStats = {
    totalSteps,
    avgSteps: completedDays > 0 ? Math.round(totalSteps / completedDays) : 0,
    totalCalories,
    avgCalories: calorieDays > 0 ? Math.round(totalCalories / calorieDays) : 0,
    totalActiveMinutes,
    workoutCount,
    daysWithWorkouts,
    daysOver8kSteps,
    completedDays,
    bestDay,
  };

  return {
    weekStart: monday,
    weekEnd: sunday,
    days,
    hasPartialData,
    mostRecentCompleteDay,
    weeklyStats,
  };
}

// Compute streaks, patterns, and per-day micro-feedback (pure function)
export function computeWeeklyEnrichments(days, weeklyStats, previousWeekStats) {
  const dataDays = days.filter(
    (d) => (d.status === "complete" || d.status === "today") && d.steps !== null,
  );

  // --- Streaks ---
  // Count consecutive days (from most recent backward) with steps >= 8k
  let stepStreak = 0;
  for (let i = dataDays.length - 1; i >= 0; i--) {
    if (dataDays[i].steps >= 8000) stepStreak++;
    else break;
  }
  // Count consecutive days with at least one workout
  let workoutStreak = 0;
  for (let i = dataDays.length - 1; i >= 0; i--) {
    if (dataDays[i].workouts && dataDays[i].workouts.length > 0) workoutStreak++;
    else break;
  }

  // --- Per-day flags ---
  const avgSteps = weeklyStats.avgSteps;
  const dayFlags = days.map((d) => {
    const flags = [];
    if (d.status === "future" || d.steps === null) return flags;
    if (d.steps >= 8000) flags.push("over_8k");
    if (avgSteps > 0 && d.steps < avgSteps * 0.7) flags.push("below_avg");
    if (d.workouts && d.workouts.length > 0) flags.push("has_workout");
    return flags;
  });

  // --- Patterns ---
  const patterns = [];

  // Weekend drop detection (compare avg weekday vs avg weekend steps)
  const weekdayDays = dataDays.filter((d) =>
    ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(d.dayOfWeek),
  );
  const weekendDays = dataDays.filter((d) =>
    ["Sat", "Sun"].includes(d.dayOfWeek),
  );
  if (weekdayDays.length >= 2 && weekendDays.length >= 1) {
    const weekdayAvg = weekdayDays.reduce((s, d) => s + d.steps, 0) / weekdayDays.length;
    const weekendAvg = weekendDays.reduce((s, d) => s + d.steps, 0) / weekendDays.length;
    if (weekdayAvg > 0 && weekendAvg < weekdayAvg * 0.7) {
      patterns.push({ type: "weekend_drop", message: "Steps dropped on weekend" });
    }
  }

  // Consistency check (coefficient of variation)
  if (dataDays.length >= 3 && avgSteps > 0) {
    const variance =
      dataDays.reduce((sum, d) => sum + Math.pow(d.steps - avgSteps, 2), 0) / dataDays.length;
    const cv = Math.sqrt(variance) / avgSteps;
    if (cv < 0.2) {
      patterns.push({ type: "consistent", message: "Consistent step count this week" });
    }
  }

  // Step streak hint
  if (stepStreak >= 3) {
    patterns.push({ type: "streak", message: `${stepStreak}-day streak over 8k steps` });
  }

  // --- Comparison deltas (vs previous week) ---
  let comparison = null;
  if (previousWeekStats && previousWeekStats.completedDays > 0) {
    const prevAvgSteps = previousWeekStats.avgSteps;
    const prevAvgCalories = previousWeekStats.avgCalories;
    const stepsDelta = prevAvgSteps > 0
      ? Math.round(((weeklyStats.avgSteps - prevAvgSteps) / prevAvgSteps) * 100)
      : null;
    const caloriesDelta = prevAvgCalories > 0
      ? Math.round(((weeklyStats.avgCalories - prevAvgCalories) / prevAvgCalories) * 100)
      : null;
    const workoutDelta = weeklyStats.workoutCount - previousWeekStats.workoutCount;

    comparison = {
      avgStepsDelta: stepsDelta,
      avgCaloriesDelta: caloriesDelta,
      workoutDelta,
      prevAvgSteps: previousWeekStats.avgSteps,
      prevWorkoutCount: previousWeekStats.workoutCount,
    };
  }

  return {
    streaks: { stepStreak, workoutStreak },
    dayFlags,
    patterns,
    comparison,
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
