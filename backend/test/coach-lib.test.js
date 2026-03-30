// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "../lib/coach.js";

const testProfile = {
  goal: "LOSE_WEIGHT",
  weightLbs: 200,
  targetWeightLbs: 180,
  age: 30,
  gender: "male",
  heightFeet: 5,
  heightInches: 10,
  activityLevel: 1.55,
};

const gainProfile = {
  goal: "GAIN_MUSCLE",
  weightLbs: 160,
  targetWeightLbs: 175,
  age: 25,
  gender: "male",
  heightFeet: 5,
  heightInches: 9,
  activityLevel: 1.55,
};

const sleepData = {
  summary: {
    totalMinutesAsleep: 420,
    totalTimeInBed: 480,
    stages: { deep: 90, light: 180, rem: 120, wake: 30 },
  },
  sleepLog: [{ efficiency: 88, startTime: "2026-03-22T23:00:00.000", endTime: "2026-03-23T07:00:00.000" }],
};

const heartRateData = {
  restingHeartRate: 62,
  zones: [
    { name: "Out of Range", min: 30, max: 104, minutes: 1200 },
    { name: "Fat Burn", min: 104, max: 134, minutes: 45 },
    { name: "Cardio", min: 134, max: 167, minutes: 12 },
    { name: "Peak", min: 167, max: 220, minutes: 3 },
  ],
};

const activityData = {
  steps: 8500,
  distance: 3.8,
  caloriesOut: 2100,
  activeMinutes: { sedentary: 600, lightlyActive: 120, fairlyActive: 25, veryActive: 15 },
  workouts: [{ name: "Weights", calories: 450, duration: 2700000, startTime: "2026-03-22T18:00:00", steps: 0 }],
};

// ─── buildSystemPrompt ─────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("includes user name and weight loss goal", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("John");
    expect(prompt).toContain("lose weight");
    expect(prompt).toContain("200 lbs");
    expect(prompt).toContain("180 lbs");
  });

  it("adapts coaching focus for muscle gain goal", () => {
    const prompt = buildSystemPrompt(gainProfile, "Mike");
    expect(prompt).toContain("build muscle");
    expect(prompt).toContain("progressive overload");
  });

  it("handles null profile with generic prompt", () => {
    const prompt = buildSystemPrompt(null, "Alex");
    expect(prompt).toContain("Alex");
    expect(prompt).toContain("haven't finished setting up");
  });

  it("uses fallback name when userName is null", () => {
    const prompt = buildSystemPrompt(testProfile, null);
    expect(prompt).toContain("there");
  });
});

// ─── buildUserMessage ──────────────────────────────────────────────

describe("buildUserMessage", () => {
  it("includes sleep data for morning context", () => {
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData });
    expect(msg).toContain("7h 0min total");
    expect(msg).toContain("88% efficiency");
    expect(msg).toContain("90min deep");
    expect(msg).toContain("62 bpm");
    expect(msg).toContain("What should I do for my workout today?");
  });

  it("excludes activity data for morning context", () => {
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData });
    expect(msg).not.toContain("Steps:");
    expect(msg).not.toContain("Workouts:");
  });

  it("includes all data for recap context", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData });
    expect(msg).toContain("8,500");
    expect(msg).toContain("2,100");
    expect(msg).toContain("Weights");
    expect(msg).toContain("45min fat burn");
    expect(msg).toContain("How did my day go?");
  });

  it("shows 'No data available' when sleep is null", () => {
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: null, heartRate: heartRateData });
    expect(msg).toContain("Sleep: No data available");
  });

  it("shows 'No data available' when HR is null", () => {
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: null });
    expect(msg).toContain("Heart rate: No data available");
  });

  it("shows 'None logged today' when workouts array is empty", () => {
    const noWorkouts = { ...activityData, workouts: [] };
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: noWorkouts, heartRate: heartRateData });
    expect(msg).toContain("None logged today");
  });

  it("shows activity not available when activity is null in recap", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: null, heartRate: heartRateData });
    expect(msg).toContain("Activity: No data available");
  });

  // ─── Yesterday comparison data ──────────────────────────────────

  it("includes yesterday sleep and HR comparison when provided", () => {
    const yesterday = {
      sleep: {
        summary: { totalMinutesAsleep: 360, stages: { deep: 70, rem: 90 } },
        sleepLog: [{ efficiency: 82 }],
      },
      heartRate: { restingHeartRate: 65 },
    };
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday });
    expect(msg).toContain("Yesterday's data (for comparison)");
    expect(msg).toContain("Yesterday sleep: 6h 0min");
    expect(msg).toContain("82% efficiency");
    expect(msg).toContain("Yesterday resting HR: 65 bpm");
    expect(msg).toContain("Yesterday stages: 70min deep, 90min REM");
  });

  it("includes yesterday activity in recap context", () => {
    const yesterday = {
      sleep: null,
      heartRate: null,
      activity: { steps: 10200, activeMinutes: { fairlyActive: 30, veryActive: 20 } },
    };
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, yesterday });
    expect(msg).toContain("Yesterday steps: 10,200");
    expect(msg).toContain("Yesterday active minutes: 50 moderate-to-vigorous");
  });

  it("excludes yesterday activity from morning context", () => {
    const yesterday = {
      sleep: { summary: { totalMinutesAsleep: 360 }, sleepLog: [] },
      heartRate: { restingHeartRate: 65 },
      activity: { steps: 10200, activeMinutes: { fairlyActive: 30, veryActive: 20 } },
    };
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday });
    expect(msg).not.toContain("Yesterday steps");
    expect(msg).not.toContain("Yesterday active minutes");
  });

  it("includes yesterday load summary for morning context", () => {
    const yesterday = {
      sleep: { summary: { totalMinutesAsleep: 360 }, sleepLog: [] },
      heartRate: { restingHeartRate: 65 },
      activity: { steps: 13600, activeMinutes: { fairlyActive: 120, veryActive: 107 }, workouts: [{ name: "Weights" }] },
    };
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday });
    expect(msg).toContain("Yesterday load: high activity day");
    expect(msg).toContain("Yesterday training: Weights");
  });

  it("classifies yesterday load as moderate when workouts present but low active minutes", () => {
    const yesterday = {
      sleep: null,
      heartRate: null,
      activity: { steps: 5000, activeMinutes: { fairlyActive: 10, veryActive: 5 }, workouts: [{ name: "Yoga" }] },
    };
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday });
    expect(msg).toContain("Yesterday load: moderate activity day");
    expect(msg).toContain("Yesterday training: Yoga");
  });

  it("classifies yesterday load as light when no workouts and low active minutes", () => {
    const yesterday = {
      sleep: null,
      heartRate: null,
      activity: { steps: 3000, activeMinutes: { fairlyActive: 5, veryActive: 2 }, workouts: [] },
    };
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday });
    expect(msg).toContain("Yesterday load: light activity day");
    expect(msg).not.toContain("Yesterday training:");
  });

  it("omits yesterday load for morning context when yesterday has no activity", () => {
    const yesterday = {
      sleep: { summary: { totalMinutesAsleep: 360 }, sleepLog: [] },
      heartRate: { restingHeartRate: 65 },
    };
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday });
    expect(msg).not.toContain("Yesterday load:");
    expect(msg).not.toContain("Yesterday training:");
  });

  it("omits yesterday section when yesterday is null", () => {
    const msg = buildUserMessage({ context: "morning", date: "2026-03-22", sleep: sleepData, heartRate: heartRateData, yesterday: null });
    expect(msg).not.toContain("Yesterday");
  });
});

// ─── buildSystemPrompt — readiness & comparison focus ────────────

describe("buildSystemPrompt — readiness focus", () => {
  it("frames role as recovery and readiness coach", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("recovery and readiness coach");
    expect(prompt).toContain("push harder, maintain effort, or pull back");
  });

  it("includes change-over-static principle", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("CHANGE over static values");
    expect(prompt).toContain("BIGGEST change");
  });

  it("requires headline direction not vague observations", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("clear DIRECTION");
    expect(prompt).toContain("push harder, stay steady, or ease up");
  });

  it("instructs comparison with yesterday when available", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("ALWAYS compare");
    expect(prompt).toContain("yesterday");
  });
});

// ─── buildSystemPrompt — training progression section ────────────

describe("buildSystemPrompt — training progression section", () => {
  it("includes training progression coach section", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("TRAINING PROGRESSION COACH");
  });

  it("includes rep range guidance", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("8-12");
  });

  it("includes trainingNote format instruction", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("trainingNote");
  });

  it("requires workout data for training note", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("do NOT include trainingNote");
  });

  it("instructs AI to use app-computed trends", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("computed trend and suggestionHint");
  });

  it("prioritizes recovery over progression when strain is high", () => {
    const prompt = buildSystemPrompt(testProfile, "John");
    expect(prompt).toContain("workoutStrain");
    expect(prompt).toContain("prioritize recovery");
  });
});

// ─── buildUserMessage — workout summary ──────────────────────────

describe("buildUserMessage — workout summary", () => {
  const workoutSummary = {
    workoutCompleted: true,
    workoutType: "strength",
    durationMin: 56,
    exerciseCount: 9,
    bodyRegion: "full_body",
    estimatedIntensity: "moderate",
    estimatedVolume: "moderate",
    avgWorkoutHeartRate: 135,
    cardioZoneMinutes: 6,
    fatBurnZoneMinutes: 41,
    peakZoneMinutes: 0,
    workoutStrain: "moderate",
  };

  it("includes workout summary section when provided", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, workoutSummary });
    expect(msg).toContain("Workout Summary:");
    expect(msg).toContain("Type: strength");
    expect(msg).toContain("Duration: 56min");
    expect(msg).toContain("Exercises: 9");
  });

  it("excludes workout summary when workoutSummary is null", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, workoutSummary: null });
    expect(msg).not.toContain("Workout Summary:");
  });

  it("formats all workout summary fields", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, workoutSummary });
    expect(msg).toContain("Body Region: full_body");
    expect(msg).toContain("Intensity: moderate");
    expect(msg).toContain("Volume: moderate");
    expect(msg).toContain("Workout Strain: moderate");
    expect(msg).toContain("Avg HR: 135 bpm");
    expect(msg).toContain("Fat Burn: 41min");
    expect(msg).toContain("Cardio: 6min");
    expect(msg).toContain("Peak: 0min");
  });
});

// ─── buildUserMessage — exercise progressions ───────────────────

describe("buildUserMessage — exercise progressions", () => {
  const exerciseProgressions = [
    {
      exercise: "Dumbbell Chest Press",
      recentSessions: [
        { date: "2026-03-20", weightLbs: 30, reps: 8, sets: 3 },
        { date: "2026-03-23", weightLbs: 30, reps: 10, sets: 3 },
        { date: "2026-03-26", weightLbs: 30, reps: 10, sets: 3 },
      ],
      trend: "stable_weight_reps_improving",
      suggestionHint: "consider_add_weight_soon",
    },
  ];

  it("includes exercise progressions when provided", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, exerciseProgressions });
    expect(msg).toContain("Exercise Progressions (app-computed");
    expect(msg).toContain("Dumbbell Chest Press");
  });

  it("excludes progressions section when exerciseProgressions is null", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, exerciseProgressions: null });
    expect(msg).not.toContain("Exercise Progressions");
  });

  it("excludes progressions section when exerciseProgressions is empty array", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, exerciseProgressions: [] });
    expect(msg).not.toContain("Exercise Progressions");
  });

  it("formats trend and hint for each exercise", () => {
    const msg = buildUserMessage({ context: "recap", date: "2026-03-22", sleep: sleepData, activity: activityData, heartRate: heartRateData, exerciseProgressions });
    expect(msg).toContain("30lbs");
    expect(msg).toContain("3x8 → 3x10 → 3x10");
    expect(msg).toContain("Trend: stable_weight_reps_improving");
    expect(msg).toContain("Hint: consider_add_weight_soon");
  });
});
