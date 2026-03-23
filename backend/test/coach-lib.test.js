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
});
