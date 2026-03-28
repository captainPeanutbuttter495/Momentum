// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalizeExerciseName,
  classifyBodyRegion,
  buildWorkoutSummary,
  buildExerciseProgressions,
} from "../lib/training-analysis.js";

// ─── normalizeExerciseName ───────────────────────────────────────

describe("normalizeExerciseName", () => {
  it("lowercases and trims", () => {
    expect(normalizeExerciseName("  Bench Press  ")).toBe("bench press");
  });

  it("normalizes DB to dumbbell", () => {
    expect(normalizeExerciseName("DB Chest Press")).toBe("dumbbell chest press");
  });

  it("normalizes BB to barbell", () => {
    expect(normalizeExerciseName("BB Squat")).toBe("barbell squat");
  });

  it("normalizes OH to overhead", () => {
    expect(normalizeExerciseName("OH Press")).toBe("overhead press");
  });

  it("normalizes EZ to ez-bar", () => {
    expect(normalizeExerciseName("EZ Curl")).toBe("ez-bar curl");
  });

  it("returns empty string for null", () => {
    expect(normalizeExerciseName(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeExerciseName("")).toBe("");
  });

  it("does not replace abbreviations inside words", () => {
    expect(normalizeExerciseName("Deadbugs")).toBe("deadbugs");
  });
});

// ─── classifyBodyRegion ──────────────────────────────────────────

describe("classifyBodyRegion", () => {
  it("classifies upper_body from exercise names", () => {
    expect(classifyBodyRegion(["Bench Press", "Bicep Curl", "Lat Pulldown"])).toBe("upper_body");
  });

  it("classifies lower_body from exercise names", () => {
    expect(classifyBodyRegion(["Squat", "Lunges", "Calf Raise"])).toBe("lower_body");
  });

  it("classifies full_body when both regions present", () => {
    expect(classifyBodyRegion(["Bench Press", "Squat", "Shoulder Press"])).toBe("full_body");
  });

  it("returns unknown for unrecognized exercises", () => {
    expect(classifyBodyRegion(["Plank", "Burpee", "Mountain Climber"])).toBe("unknown");
  });

  it("returns unknown for null input", () => {
    expect(classifyBodyRegion(null)).toBe("unknown");
  });

  it("returns unknown for empty array", () => {
    expect(classifyBodyRegion([])).toBe("unknown");
  });

  it("handles leg curl as lower body", () => {
    expect(classifyBodyRegion(["Leg Curl"])).toBe("lower_body");
  });
});

// ─── buildWorkoutSummary ─────────────────────────────────────────

describe("buildWorkoutSummary", () => {
  const strengthLogs = [
    {
      exercises: [
        { name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 },
        { name: "Squat", weightLbs: 225, sets: 4, reps: 8 },
        { name: "Bicep Curl", weightLbs: 30, sets: 3, reps: 12 },
      ],
    },
  ];

  const fitbitActivity = {
    workouts: [
      {
        name: "Weights",
        duration: 3360000, // 56 min
        calories: 450,
        heartRateZones: [
          { name: "Fat Burn", minutes: 41 },
          { name: "Cardio", minutes: 6 },
          { name: "Peak", minutes: 0 },
        ],
        averageHeartRate: 135,
      },
    ],
  };

  it("returns null when no workout data exists", () => {
    expect(buildWorkoutSummary(null, null)).toBeNull();
    expect(buildWorkoutSummary({}, null)).toBeNull();
    expect(buildWorkoutSummary({ workouts: [] }, null)).toBeNull();
    expect(buildWorkoutSummary(null, [])).toBeNull();
  });

  it("identifies strength workout from manual exercise logs", () => {
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.workoutType).toBe("strength");
    expect(summary.workoutCompleted).toBe(true);
  });

  it("identifies cardio workout from Fitbit data without manual exercises", () => {
    const summary = buildWorkoutSummary(fitbitActivity, null);
    expect(summary.workoutType).toBe("cardio");
  });

  it("identifies mixed workout when both sources present", () => {
    const summary = buildWorkoutSummary(fitbitActivity, strengthLogs);
    expect(summary.workoutType).toBe("mixed");
  });

  it("calculates duration from Fitbit workout duration", () => {
    const summary = buildWorkoutSummary(fitbitActivity, strengthLogs);
    expect(summary.durationMin).toBe(56);
  });

  it("estimates duration from exercise count when no Fitbit data", () => {
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.durationMin).toBe(15); // 3 exercises * 5 min
  });

  it("counts exercises across all workout logs", () => {
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.exerciseCount).toBe(3);
  });

  it("classifies body region from exercises", () => {
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.bodyRegion).toBe("full_body"); // bench + squat
  });

  it("calculates volume from sets x reps", () => {
    // 3*10 + 4*8 + 3*12 = 30 + 32 + 36 = 98
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.estimatedVolume).toBe("moderate"); // 98 is in 50-100 range
  });

  it("classifies high volume when sets x reps > 100", () => {
    const highVolLogs = [
      {
        exercises: [
          { name: "Bench Press", weightLbs: 135, sets: 5, reps: 12 },
          { name: "Rows", weightLbs: 100, sets: 5, reps: 12 },
        ],
      },
    ];
    const summary = buildWorkoutSummary(null, highVolLogs);
    expect(summary.estimatedVolume).toBe("high"); // 120
  });

  it("classifies low volume when sets x reps < 50", () => {
    const lowVolLogs = [
      {
        exercises: [
          { name: "Bench Press", weightLbs: 135, sets: 3, reps: 5 },
        ],
      },
    ];
    const summary = buildWorkoutSummary(null, lowVolLogs);
    expect(summary.estimatedVolume).toBe("low"); // 15
  });

  it("determines moderate intensity from HR zones", () => {
    const summary = buildWorkoutSummary(fitbitActivity, strengthLogs);
    // cardio 6 + peak 0 = 6, which is > 5 but <= 15
    expect(summary.estimatedIntensity).toBe("moderate");
  });

  it("determines high intensity when cardio+peak > 15min", () => {
    const highIntensity = {
      workouts: [
        {
          name: "HIIT",
          duration: 2400000,
          heartRateZones: [
            { name: "Fat Burn", minutes: 10 },
            { name: "Cardio", minutes: 12 },
            { name: "Peak", minutes: 8 },
          ],
          averageHeartRate: 165,
        },
      ],
    };
    const summary = buildWorkoutSummary(highIntensity, null);
    expect(summary.estimatedIntensity).toBe("high");
  });

  it("determines low intensity without HR zone data", () => {
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.estimatedIntensity).toBe("low"); // no HR zones
  });

  it("extracts HR zone minutes from Fitbit workout", () => {
    const summary = buildWorkoutSummary(fitbitActivity, strengthLogs);
    expect(summary.fatBurnZoneMinutes).toBe(41);
    expect(summary.cardioZoneMinutes).toBe(6);
    expect(summary.peakZoneMinutes).toBe(0);
  });

  it("extracts average workout HR", () => {
    const summary = buildWorkoutSummary(fitbitActivity, strengthLogs);
    expect(summary.avgWorkoutHeartRate).toBe(135);
  });

  it("returns null avgWorkoutHeartRate when no Fitbit data", () => {
    const summary = buildWorkoutSummary(null, strengthLogs);
    expect(summary.avgWorkoutHeartRate).toBeNull();
  });

  it("determines moderate workout strain", () => {
    const summary = buildWorkoutSummary(fitbitActivity, strengthLogs);
    expect(summary.workoutStrain).toBe("moderate");
  });

  it("determines high workout strain for long full-body sessions", () => {
    const longActivity = {
      workouts: [
        {
          name: "Weights",
          duration: 4200000, // 70 min
          heartRateZones: [
            { name: "Fat Burn", minutes: 50 },
            { name: "Cardio", minutes: 10 },
            { name: "Peak", minutes: 5 },
          ],
          averageHeartRate: 140,
        },
      ],
    };
    const fullBodyLogs = [
      {
        exercises: [
          { name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 },
          { name: "Squat", weightLbs: 225, sets: 4, reps: 8 },
        ],
      },
    ];
    const summary = buildWorkoutSummary(longActivity, fullBodyLogs);
    expect(summary.workoutStrain).toBe("high");
  });

  it("determines low workout strain for short light sessions", () => {
    const shortActivity = {
      workouts: [
        {
          name: "Walk",
          duration: 1200000, // 20 min
          heartRateZones: [
            { name: "Fat Burn", minutes: 15 },
            { name: "Cardio", minutes: 0 },
            { name: "Peak", minutes: 0 },
          ],
          averageHeartRate: 100,
        },
      ],
    };
    const summary = buildWorkoutSummary(shortActivity, null);
    expect(summary.workoutStrain).toBe("low");
  });

  it("handles empty workout logs array", () => {
    expect(buildWorkoutSummary(null, [])).toBeNull();
  });

  it("handles activity with empty workouts array", () => {
    expect(buildWorkoutSummary({ workouts: [] }, null)).toBeNull();
  });
});

// ─── buildExerciseProgressions ───────────────────────────────────

describe("buildExerciseProgressions", () => {
  it("returns empty array when recentWorkouts is null", () => {
    expect(buildExerciseProgressions(null)).toEqual([]);
  });

  it("returns empty array when recentWorkouts is empty", () => {
    expect(buildExerciseProgressions([])).toEqual([]);
  });

  it("excludes exercises that appear in only 1 session", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    expect(buildExerciseProgressions(workouts)).toEqual([]);
  });

  it("groups exercises by normalized name across sessions", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "DB Chest Press", weightLbs: 30, sets: 3, reps: 8 }] },
      { date: "2026-03-23", exercises: [{ name: "db chest press", weightLbs: 30, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result).toHaveLength(1);
    expect(result[0].recentSessions).toHaveLength(2);
  });

  it("detects weight_increasing trend", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 140, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].trend).toBe("weight_increasing");
  });

  it("detects reps_increasing trend at stable weight hitting ceiling", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].trend).toBe("reps_increasing");
  });

  it("detects stable_weight_reps_improving trend", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 8 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].trend).toBe("stable_weight_reps_improving");
  });

  it("detects stalled trend — same weight and reps for 3+ sessions", () => {
    const workouts = [
      { date: "2026-03-18", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].trend).toBe("stalled");
  });

  it("detects weight_increased_reps_dropped after load increase", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 140, sets: 3, reps: 8 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].trend).toBe("weight_increased_reps_dropped");
  });

  it("detects declining trend", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 130, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].trend).toBe("declining");
  });

  it("suggests consider_add_weight_soon when reps hit 12 for 2 sessions", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].suggestionHint).toBe("consider_add_weight_soon");
  });

  it("suggests increase_weight when reps at 12+ for 3+ sessions", () => {
    const workouts = [
      { date: "2026-03-18", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 13 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].suggestionHint).toBe("increase_weight");
  });

  it("suggests hold_and_build when reps below 8 after weight increase", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 140, sets: 3, reps: 6 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].suggestionHint).toBe("hold_and_build");
  });

  it("suggests progressing_well for increasing weight", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 140, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].suggestionHint).toBe("progressing_well");
  });

  it("suggests progressing_well for stable_weight_reps_improving", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 8 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].suggestionHint).toBe("progressing_well");
  });

  it("suggests stalled_consider_change after 3+ unchanged sessions", () => {
    const workouts = [
      { date: "2026-03-18", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].suggestionHint).toBe("stalled_consider_change");
  });

  it("returns null suggestion with insufficient data", () => {
    const workouts = [
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    // 2 sessions same weight same reps — stalled but only 2 sessions, not 3
    expect(result[0].suggestionHint).toBeNull();
  });

  it("sorts recentSessions by date ascending in output", () => {
    const workouts = [
      { date: "2026-03-23", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 12 }] },
      { date: "2026-03-18", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 8 }] },
      { date: "2026-03-20", exercises: [{ name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 }] },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result[0].recentSessions[0].date).toBe("2026-03-18");
    expect(result[0].recentSessions[1].date).toBe("2026-03-20");
    expect(result[0].recentSessions[2].date).toBe("2026-03-23");
  });

  it("handles multiple exercises across sessions", () => {
    const workouts = [
      {
        date: "2026-03-20",
        exercises: [
          { name: "Bench Press", weightLbs: 135, sets: 3, reps: 10 },
          { name: "Squat", weightLbs: 225, sets: 4, reps: 8 },
        ],
      },
      {
        date: "2026-03-23",
        exercises: [
          { name: "Bench Press", weightLbs: 140, sets: 3, reps: 10 },
          { name: "Squat", weightLbs: 225, sets: 4, reps: 10 },
        ],
      },
    ];
    const result = buildExerciseProgressions(workouts);
    expect(result).toHaveLength(2);
  });
});
