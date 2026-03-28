// Pure-function module for workout summary and exercise progression analysis.
// No I/O, no API calls — app detects patterns, AI explains them.

const TARGET_REP_MIN = 8;
const TARGET_REP_MAX = 12;

const ABBREVIATIONS = {
  db: "dumbbell",
  bb: "barbell",
  oh: "overhead",
  ez: "ez-bar",
};

const UPPER_KEYWORDS = [
  "chest", "press", "tricep", "shoulder", "fly", "flye",
  "row", "pulldown", "lat", "bicep", "pullup", "pull-up", "push-up",
  "pushup", "dip", "shrug",
];

const LOWER_KEYWORDS = [
  "squat", "deadlift", "leg", "calf", "lunge", "hamstring", "glute",
  "hip", "rdl",
];

export function normalizeExerciseName(name) {
  if (!name || typeof name !== "string") return "";
  let normalized = name.trim().toLowerCase();
  // Replace abbreviations as whole words
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    normalized = normalized.replace(new RegExp(`\\b${abbr}\\b`, "g"), full);
  }
  return normalized;
}

export function classifyBodyRegion(exerciseNames) {
  if (!exerciseNames || exerciseNames.length === 0) return "unknown";

  let hasUpper = false;
  let hasLower = false;

  for (const name of exerciseNames) {
    const normalized = normalizeExerciseName(name);
    if (!normalized) continue;

    let isUpper = false;
    let isLower = false;

    for (const kw of LOWER_KEYWORDS) {
      if (normalized.includes(kw)) {
        isLower = true;
        break;
      }
    }

    if (!isLower) {
      for (const kw of UPPER_KEYWORDS) {
        if (normalized.includes(kw)) {
          isUpper = true;
          break;
        }
      }
    }

    if (isUpper) hasUpper = true;
    if (isLower) hasLower = true;
  }

  if (hasUpper && hasLower) return "full_body";
  if (hasUpper) return "upper_body";
  if (hasLower) return "lower_body";
  return "unknown";
}

function getHRZoneMinutes(workouts, zoneName) {
  let total = 0;
  for (const w of workouts) {
    if (w.heartRateZones) {
      const zone = w.heartRateZones.find((z) => z.name === zoneName);
      if (zone?.minutes) total += zone.minutes;
    }
  }
  return total;
}

function getAvgWorkoutHR(workouts) {
  const hrs = workouts.filter((w) => w.averageHeartRate).map((w) => w.averageHeartRate);
  if (hrs.length === 0) return null;
  return Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
}

function getTotalDurationMin(workouts) {
  let total = 0;
  for (const w of workouts) {
    if (w.duration) total += w.duration;
  }
  return Math.round(total / 60000);
}

function countExercises(workoutLogs) {
  let count = 0;
  for (const log of workoutLogs) {
    count += (log.exercises || []).length;
  }
  return count;
}

function computeTotalVolume(workoutLogs) {
  let total = 0;
  for (const log of workoutLogs) {
    for (const ex of log.exercises || []) {
      total += (ex.sets || 0) * (ex.reps || 0);
    }
  }
  return total;
}

function hasStrengthExercises(workoutLogs) {
  for (const log of workoutLogs) {
    for (const ex of log.exercises || []) {
      if (ex.weightLbs > 0) return true;
    }
  }
  return false;
}

export function buildWorkoutSummary(activity, workoutLogs) {
  const hasLogs = workoutLogs && workoutLogs.length > 0;
  const fitbitWorkouts = activity?.workouts || [];
  const hasFitbit = fitbitWorkouts.length > 0;

  if (!hasLogs && !hasFitbit) return null;

  const exerciseCount = hasLogs ? countExercises(workoutLogs) : 0;
  const hasStrength = hasLogs && hasStrengthExercises(workoutLogs);

  // Workout type
  let workoutType;
  if (hasStrength && hasFitbit) workoutType = "mixed";
  else if (hasStrength) workoutType = "strength";
  else workoutType = "cardio";

  // Duration
  const durationMin = hasFitbit
    ? getTotalDurationMin(fitbitWorkouts)
    : exerciseCount * 5; // estimate ~5 min per exercise

  // Body region
  const allExerciseNames = hasLogs
    ? workoutLogs.flatMap((log) => (log.exercises || []).map((ex) => ex.name))
    : [];
  const bodyRegion = classifyBodyRegion(allExerciseNames);

  // HR zone minutes
  const fatBurnZoneMinutes = hasFitbit ? getHRZoneMinutes(fitbitWorkouts, "Fat Burn") : 0;
  const cardioZoneMinutes = hasFitbit ? getHRZoneMinutes(fitbitWorkouts, "Cardio") : 0;
  const peakZoneMinutes = hasFitbit ? getHRZoneMinutes(fitbitWorkouts, "Peak") : 0;

  // Average HR
  const avgWorkoutHeartRate = hasFitbit ? getAvgWorkoutHR(fitbitWorkouts) : null;

  // Intensity from HR zones
  const highIntensityMin = cardioZoneMinutes + peakZoneMinutes;
  let estimatedIntensity;
  if (highIntensityMin > 15) estimatedIntensity = "high";
  else if (highIntensityMin > 5) estimatedIntensity = "moderate";
  else estimatedIntensity = "low";

  // Volume from sets x reps
  const totalVolume = hasLogs ? computeTotalVolume(workoutLogs) : 0;
  let estimatedVolume;
  if (totalVolume > 100) estimatedVolume = "high";
  else if (totalVolume >= 50) estimatedVolume = "moderate";
  else estimatedVolume = "low";

  // Workout strain — composite
  let workoutStrain;
  const isHighStrain =
    durationMin > 60 && (bodyRegion === "full_body" || estimatedIntensity === "high");
  const isLowStrain =
    durationMin < 30 && (exerciseCount < 4 || estimatedIntensity === "low");

  if (isHighStrain) workoutStrain = "high";
  else if (isLowStrain) workoutStrain = "low";
  else workoutStrain = "moderate";

  return {
    workoutCompleted: true,
    workoutType,
    durationMin,
    exerciseCount,
    bodyRegion,
    estimatedIntensity,
    estimatedVolume,
    avgWorkoutHeartRate,
    cardioZoneMinutes,
    fatBurnZoneMinutes,
    peakZoneMinutes,
    workoutStrain,
  };
}

function determineTrend(sessions) {
  if (sessions.length < 2) return null;

  const recent = sessions.slice(-3); // last 3 sessions max
  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];

  // Weight increased
  if (last.weightLbs > prev.weightLbs) {
    if (last.reps < prev.reps) return "weight_increased_reps_dropped";
    return "weight_increasing";
  }

  // Weight decreased without prior increase
  if (last.weightLbs < prev.weightLbs) {
    return "declining";
  }

  // Same weight — check reps
  if (last.weightLbs === prev.weightLbs) {
    // Check for stall: 3+ sessions same weight AND same reps
    if (recent.length >= 3) {
      const allSameWeight = recent.every((s) => s.weightLbs === last.weightLbs);
      const allSameReps = recent.every((s) => s.reps === last.reps);
      if (allSameWeight && allSameReps) return "stalled";
    }

    if (last.reps > prev.reps) {
      if (last.reps >= TARGET_REP_MAX) return "reps_increasing";
      return "stable_weight_reps_improving";
    }

    if (last.reps < prev.reps) return "declining";

    // Same reps, same weight, only 2 sessions — not enough to call stalled
    return "stalled";
  }

  return null;
}

function determineSuggestionHint(sessions, trend) {
  if (!trend || sessions.length < 2) return null;

  const recent = sessions.slice(-3);
  const last = recent[recent.length - 1];

  // Count consecutive sessions at same weight hitting top of range
  const sameWeightSessions = [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].weightLbs === last.weightLbs) {
      sameWeightSessions.unshift(sessions[i]);
    } else {
      break;
    }
  }

  const atCeiling = sameWeightSessions.filter((s) => s.reps >= TARGET_REP_MAX);

  if (atCeiling.length >= 3) return "increase_weight";
  if (atCeiling.length >= 2) return "consider_add_weight_soon";

  if (trend === "weight_increased_reps_dropped" && last.reps < TARGET_REP_MIN) {
    return "hold_and_build";
  }

  if (trend === "weight_increasing" || trend === "reps_increasing" || trend === "stable_weight_reps_improving") {
    return "progressing_well";
  }

  // Stalled for 3+ sessions
  if (trend === "stalled" && sameWeightSessions.length >= 3) {
    const allSameReps = sameWeightSessions.slice(-3).every((s) => s.reps === last.reps);
    if (allSameReps) return "stalled_consider_change";
  }

  return null;
}

export function buildExerciseProgressions(recentWorkouts) {
  if (!recentWorkouts || recentWorkouts.length === 0) return [];

  // Group exercises by normalized name across all sessions
  const exerciseMap = new Map();

  for (const log of recentWorkouts) {
    for (const ex of log.exercises || []) {
      const normalized = normalizeExerciseName(ex.name);
      if (!normalized) continue;

      if (!exerciseMap.has(normalized)) {
        exerciseMap.set(normalized, { displayName: ex.name, sessions: [] });
      }

      exerciseMap.get(normalized).sessions.push({
        date: log.date,
        weightLbs: ex.weightLbs || 0,
        reps: ex.reps || 0,
        sets: ex.sets || 0,
      });
    }
  }

  const progressions = [];

  for (const [, data] of exerciseMap) {
    // Only include exercises with 2+ sessions (different dates)
    const uniqueDates = new Set(data.sessions.map((s) => s.date));
    if (uniqueDates.size < 2) continue;

    // Deduplicate: keep one entry per date (first occurrence)
    const byDate = new Map();
    for (const s of data.sessions) {
      if (!byDate.has(s.date)) {
        byDate.set(s.date, s);
      }
    }

    const sessions = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const trend = determineTrend(sessions);
    const suggestionHint = determineSuggestionHint(sessions, trend);

    progressions.push({
      exercise: data.displayName,
      recentSessions: sessions,
      trend,
      suggestionHint,
    });
  }

  return progressions;
}
