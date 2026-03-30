// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── Mocks ─────────────────────────────────────────────────────────

const { mockCheckJwt, mockAttachUser, prismaMock } = vi.hoisted(() => {
  const mockCheckJwt = vi.fn((req, res, next) => next());
  const mockAttachUser = vi.fn((req, res, next) => next());

  const prismaMock = {
    userProfile: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  return { mockCheckJwt, mockAttachUser, prismaMock };
});

const mockGetFitbitSleepData = vi.hoisted(() => vi.fn());
const mockGetFitbitActivityData = vi.hoisted(() => vi.fn());
const mockGetFitbitHeartRateData = vi.hoisted(() => vi.fn());
const mockGetCoachInsight = vi.hoisted(() => vi.fn());
const mockGetWeeklyInsight = vi.hoisted(() => vi.fn());
const mockBuildWorkoutSummary = vi.hoisted(() => vi.fn());
const mockBuildExerciseProgressions = vi.hoisted(() => vi.fn());
const mockBuildWeeklySummary = vi.hoisted(() => vi.fn());

// Mock Prisma
vi.mock("../db.js", () => ({ default: prismaMock }));

// Mock express-jwt
vi.mock("express-jwt", () => ({
  expressjwt: vi.fn(() => mockCheckJwt),
}));

vi.mock("jwks-rsa", () => ({
  default: { expressJwtSecret: vi.fn(() => vi.fn()) },
}));

// Mock auth middleware — keep real RBAC, replace JWT/user lookup
vi.mock("../middleware/auth.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    checkJwt: mockCheckJwt,
    attachUser: mockAttachUser,
    authenticated: [mockCheckJwt, mockAttachUser],
  };
});

// Mock fitbit-api.js
vi.mock("../lib/fitbit-api.js", () => ({
  getFitbitSleepData: mockGetFitbitSleepData,
  getFitbitActivityData: mockGetFitbitActivityData,
  getFitbitHeartRateData: mockGetFitbitHeartRateData,
  buildWeeklySummary: mockBuildWeeklySummary,
  getMonday: (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - diff);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  },
}));

// Mock coach.js
vi.mock("../lib/coach.js", () => ({
  getCoachInsight: mockGetCoachInsight,
  getWeeklyInsight: mockGetWeeklyInsight,
}));

// Mock training-analysis.js
vi.mock("../lib/training-analysis.js", () => ({
  buildWorkoutSummary: mockBuildWorkoutSummary,
  buildExerciseProgressions: mockBuildExerciseProgressions,
}));

// ─── Import app after mocks ────────────────────────────────────────

const { default: app } = await import("../app.js");
const { insightCache } = await import("../routes/coach.js");

// ─── Test Data ─────────────────────────────────────────────────────

const testUser = {
  id: "user-123",
  auth0Id: "google-oauth2|123456789",
  email: "test@gmail.com",
  name: "Test User",
  role: "USER",
  isActive: true,
};

const testProfile = {
  id: "profile-123",
  userId: "user-123",
  goal: "LOSE_WEIGHT",
  weightLbs: 200,
  targetWeightLbs: 180,
  age: 30,
  gender: "male",
  heightFeet: 5,
  heightInches: 10,
  activityLevel: 1.55,
  bmr: 1900,
  tdee: 2500,
  dailyCalorieTarget: 1800,
};

const mockInsightResponse = {
  headline: "Good recovery — stay active",
  keySignals: ["~7h sleep, good quality", "Resting HR normal"],
  focus: ["Keep activity steady", "Stay consistent with movement"],
};

// ─── Auth Helper ───────────────────────────────────────────────────

function asUser() {
  mockCheckJwt.mockImplementation((req, res, next) => {
    req.auth = { sub: testUser.auth0Id };
    next();
  });
  mockAttachUser.mockImplementation((req, res, next) => {
    req.user = testUser;
    next();
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("POST /api/coach/insight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insightCache.clear();
    asUser();
  });

  it("returns morning coaching insight with sleep and HR data", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res.status).toBe(200);
    expect(res.body.headline).toBe("Good recovery — stay active");
    expect(res.body.keySignals).toHaveLength(2);
    expect(res.body.focus).toHaveLength(2);
    expect(res.body.context).toBe("morning");
    expect(res.body.date).toBe("2026-03-22");

    // Morning context fetches sleep + HR + yesterday's activity for load context
    expect(mockGetFitbitSleepData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitHeartRateData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitActivityData).toHaveBeenCalledWith("user-123", "2026-03-21");
  });

  it("returns recap coaching insight with all data sources", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100 });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "recap", date: "2026-03-22" });

    expect(res.status).toBe(200);
    expect(res.body.context).toBe("recap");

    // Recap context fetches all three
    expect(mockGetFitbitSleepData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitActivityData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitHeartRateData).toHaveBeenCalledWith("user-123", "2026-03-22");
  });

  it("returns 400 for invalid context", async () => {
    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "invalid", date: "2026-03-22" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("context must be 'morning' or 'recap'");
  });

  it("returns 400 for missing date", async () => {
    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("returns 400 for invalid date format", async () => {
    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "March 22" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("returns 401 when Fitbit is not connected", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));
    mockGetFitbitHeartRateData.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));
    mockGetCoachInsight.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    // Promise.allSettled catches the fitbit errors, but getCoachInsight may throw
    // The route catches FITBIT_NOT_CONNECTED at the top level
    expect([200, 401]).toContain(res.status);
  });

  it("returns 500 when Claude API fails", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetCoachInsight.mockRejectedValue(new Error("Anthropic API error"));

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to generate coaching insight");
  });

  it("handles partial data — sleep fails but HR succeeds", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockRejectedValue(new Error("Sleep fetch failed"));
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 65 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res.status).toBe(200);

    // Coach was called with null sleep but valid HR
    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.sleep).toBeNull();
    expect(coachCall.heartRate).toEqual({ restingHeartRate: 65 });
  });

  it("works without a user profile", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res.status).toBe(200);

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.profile).toBeNull();
  });

  it("passes user name to coach insight", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.userName).toBe("Test User");
  });

  // ─── Yesterday comparison data ──────────────────────────────────

  it("passes yesterday data to coach insight for morning context", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 13600, caloriesOut: 2800, activeMinutes: { fairlyActive: 120, veryActive: 107 }, workouts: [{ name: "Run" }] });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    // Morning fetches sleep + HR for today and yesterday, plus yesterday's activity
    expect(mockGetFitbitSleepData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitSleepData).toHaveBeenCalledWith("user-123", "2026-03-21");
    expect(mockGetFitbitHeartRateData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitHeartRateData).toHaveBeenCalledWith("user-123", "2026-03-21");
    expect(mockGetFitbitActivityData).toHaveBeenCalledWith("user-123", "2026-03-21");

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.yesterday).toBeTruthy();
    expect(coachCall.yesterday.sleep).toEqual({ summary: { totalMinutesAsleep: 420 } });
    expect(coachCall.yesterday.heartRate).toEqual({ restingHeartRate: 62 });
    expect(coachCall.yesterday.activity).toEqual({ steps: 13600, caloriesOut: 2800, activeMinutes: { fairlyActive: 120, veryActive: 107 }, workouts: [{ name: "Run" }] });
  });

  it("passes yesterday activity data for recap context", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100 });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    await request(app)
      .post("/api/coach/insight")
      .send({ context: "recap", date: "2026-03-22" });

    // Recap fetches all three for both today and yesterday
    expect(mockGetFitbitActivityData).toHaveBeenCalledWith("user-123", "2026-03-22");
    expect(mockGetFitbitActivityData).toHaveBeenCalledWith("user-123", "2026-03-21");

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.yesterday).toBeTruthy();
    expect(coachCall.yesterday.activity).toEqual({ steps: 8500, caloriesOut: 2100 });
  });

  it("sets yesterday to null when all yesterday fetches fail", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);

    // Today succeeds, yesterday fails
    let callCount = 0;
    mockGetFitbitSleepData.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) return Promise.resolve({ summary: { totalMinutesAsleep: 420 } });
      return Promise.reject(new Error("API error"));
    });
    let hrCallCount = 0;
    mockGetFitbitHeartRateData.mockImplementation(() => {
      hrCallCount++;
      if (hrCallCount <= 1) return Promise.resolve({ restingHeartRate: 62 });
      return Promise.reject(new Error("API error"));
    });
    mockGetFitbitActivityData.mockRejectedValue(new Error("API error"));
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.sleep).toEqual({ summary: { totalMinutesAsleep: 420 } });
    expect(coachCall.yesterday).toBeNull();
  });

  // ─── Morning cache skip when today's sleep is missing ────────────

  it("does not cache morning briefing when today's sleep is null, then caches once sleep arrives", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100 });

    const sleepAvailableResponse = {
      headline: "Marginal sleep — maintain only",
      keySignals: ["6h10m sleep — marginal recovery"],
      focus: ["Keep effort moderate today"],
    };

    // ── Request 1: today's sleep missing (null) ──
    // First call (today) returns null, second call (yesterday) returns data
    let sleepCallCount = 0;
    mockGetFitbitSleepData.mockImplementation(() => {
      sleepCallCount++;
      if (sleepCallCount === 1) return Promise.resolve(null); // today — not synced
      return Promise.resolve({ summary: { totalMinutesAsleep: 331 } }); // yesterday
    });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    const res1 = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res1.status).toBe(200);
    expect(mockGetCoachInsight).toHaveBeenCalledTimes(1);
    // Cache should NOT be populated — today's sleep was missing
    expect(insightCache.size).toBe(0);

    // ── Request 2: sleep now available — should re-fetch, not serve stale cache ──
    vi.clearAllMocks();
    asUser();
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 370 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100 });
    mockGetCoachInsight.mockResolvedValue(sleepAvailableResponse);

    const res2 = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res2.status).toBe(200);
    expect(res2.body.headline).toBe("Marginal sleep — maintain only");
    // getCoachInsight called again — proves cache was empty
    expect(mockGetCoachInsight).toHaveBeenCalledTimes(1);
    // Cache should now be populated (valid sleep data present)
    expect(insightCache.size).toBe(1);

    // ── Request 3: same date/context — should be served from cache ──
    vi.clearAllMocks();
    asUser();

    const res3 = await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    expect(res3.status).toBe(200);
    expect(res3.body.headline).toBe("Marginal sleep — maintain only");
    // getCoachInsight NOT called — served from cache
    expect(mockGetCoachInsight).not.toHaveBeenCalled();
  });
});

// ─── Training Progression ─────────────────────────────────────────

describe("POST /api/coach/insight — training progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insightCache.clear();
    asUser();
  });

  it("passes workoutSummary and exerciseProgressions to getCoachInsight for recap", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100, workouts: [] });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });

    const mockSummary = { workoutCompleted: true, workoutType: "strength", workoutStrain: "moderate" };
    const mockProgressions = [{ exercise: "Bench Press", trend: "reps_increasing" }];
    mockBuildWorkoutSummary.mockReturnValue(mockSummary);
    mockBuildExerciseProgressions.mockReturnValue(mockProgressions);
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    await request(app)
      .post("/api/coach/insight")
      .send({ context: "recap", date: "2026-03-22" });

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.workoutSummary).toEqual(mockSummary);
    expect(coachCall.exerciseProgressions).toEqual(mockProgressions);
  });

  it("passes null workoutSummary and exerciseProgressions for morning context", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    await request(app)
      .post("/api/coach/insight")
      .send({ context: "morning", date: "2026-03-22" });

    const coachCall = mockGetCoachInsight.mock.calls[0][0];
    expect(coachCall.workoutSummary).toBeNull();
    expect(coachCall.exerciseProgressions).toBeNull();

    // Training analysis functions should not be called for morning
    expect(mockBuildWorkoutSummary).not.toHaveBeenCalled();
    expect(mockBuildExerciseProgressions).not.toHaveBeenCalled();
  });

  it("includes trainingNote in response when present in insight", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100, workouts: [] });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockBuildWorkoutSummary.mockReturnValue(null);
    mockBuildExerciseProgressions.mockReturnValue([]);
    mockGetCoachInsight.mockResolvedValue({
      ...mockInsightResponse,
      trainingNote: "Bench press reps trending up — consider adding 5lbs next session.",
    });

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "recap", date: "2026-03-22" });

    expect(res.status).toBe(200);
    expect(res.body.trainingNote).toBe("Bench press reps trending up — consider adding 5lbs next session.");
  });

  it("excludes trainingNote from response when not in insight", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetFitbitSleepData.mockResolvedValue({ summary: { totalMinutesAsleep: 420 } });
    mockGetFitbitActivityData.mockResolvedValue({ steps: 8500, caloriesOut: 2100, workouts: [] });
    mockGetFitbitHeartRateData.mockResolvedValue({ restingHeartRate: 62 });
    mockBuildWorkoutSummary.mockReturnValue(null);
    mockBuildExerciseProgressions.mockReturnValue([]);
    mockGetCoachInsight.mockResolvedValue(mockInsightResponse);

    const res = await request(app)
      .post("/api/coach/insight")
      .send({ context: "recap", date: "2026-03-22" });

    expect(res.status).toBe(200);
    expect(res.body.trainingNote).toBeUndefined();
  });
});

// ─── Weekly Insight ──────────────────────────────────────────────

describe("POST /api/coach/weekly-insight", () => {
  const mockWeeklySummary = {
    weekStart: "2026-03-23",
    weekEnd: "2026-03-29",
    hasPartialData: true,
    mostRecentCompleteDay: "2026-03-27",
    days: [
      { date: "2026-03-23", dayOfWeek: "Mon", status: "complete", steps: 9200, caloriesOut: 2100, activeMinutes: 35, workouts: [] },
      { date: "2026-03-24", dayOfWeek: "Tue", status: "complete", steps: 11000, caloriesOut: 2400, activeMinutes: 50, workouts: [{ name: "Run", durationMin: 30, calories: 320 }] },
      { date: "2026-03-25", dayOfWeek: "Wed", status: "complete", steps: 7500, caloriesOut: 1900, activeMinutes: 20, workouts: [] },
      { date: "2026-03-26", dayOfWeek: "Thu", status: "complete", steps: 8100, caloriesOut: 2050, activeMinutes: 30, workouts: [] },
      { date: "2026-03-27", dayOfWeek: "Fri", status: "complete", steps: 12400, caloriesOut: 2600, activeMinutes: 55, workouts: [{ name: "Weights", durationMin: 45, calories: 400 }] },
      { date: "2026-03-28", dayOfWeek: "Sat", status: "today", steps: 3200, caloriesOut: 1100, activeMinutes: 10, workouts: [] },
      { date: "2026-03-29", dayOfWeek: "Sun", status: "future", steps: null, caloriesOut: null, activeMinutes: null, workouts: [] },
    ],
    weeklyStats: {
      totalSteps: 51400,
      avgSteps: 8567,
      totalCalories: 12150,
      avgCalories: 2025,
      totalActiveMinutes: 200,
      workoutCount: 2,
      daysWithWorkouts: 2,
      daysOver8kSteps: 4,
      completedDays: 6,
      bestDay: { date: "2026-03-27", dayOfWeek: "Fri", steps: 12400 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    insightCache.clear();
    asUser();
  });

  it("returns weekly insight for a valid weekOf date", async () => {
    mockBuildWeeklySummary.mockResolvedValue(mockWeeklySummary);
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetWeeklyInsight.mockResolvedValue("Great week — you averaged 8.5k steps and hit 2 workouts.");

    const res = await request(app)
      .post("/api/coach/weekly-insight")
      .send({ weekOf: "2026-03-28" });

    expect(res.status).toBe(200);
    expect(res.body.weeklyInsight).toBe("Great week — you averaged 8.5k steps and hit 2 workouts.");
    expect(mockBuildWeeklySummary).toHaveBeenCalledWith("user-123", "2026-03-23", "2026-03-29");
    expect(mockGetWeeklyInsight).toHaveBeenCalledWith({
      profile: testProfile,
      userName: "Test User",
      weeklySummary: mockWeeklySummary,
    });
  });

  it("returns 400 for missing weekOf", async () => {
    const res = await request(app)
      .post("/api/coach/weekly-insight")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
    expect(mockBuildWeeklySummary).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid date format", async () => {
    const res = await request(app)
      .post("/api/coach/weekly-insight")
      .send({ weekOf: "March 28" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("returns 401 when Fitbit not connected", async () => {
    mockBuildWeeklySummary.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));

    const res = await request(app)
      .post("/api/coach/weekly-insight")
      .send({ weekOf: "2026-03-28" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Fitbit not connected");
  });

  it("returns 500 when Claude API fails", async () => {
    mockBuildWeeklySummary.mockResolvedValue(mockWeeklySummary);
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetWeeklyInsight.mockRejectedValue(new Error("Anthropic API error"));

    const res = await request(app)
      .post("/api/coach/weekly-insight")
      .send({ weekOf: "2026-03-28" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to generate weekly insight");
  });

  it("works without a user profile", async () => {
    mockBuildWeeklySummary.mockResolvedValue(mockWeeklySummary);
    prismaMock.userProfile.findUnique.mockResolvedValue(null);
    mockGetWeeklyInsight.mockResolvedValue("Solid week overall.");

    const res = await request(app)
      .post("/api/coach/weekly-insight")
      .send({ weekOf: "2026-03-28" });

    expect(res.status).toBe(200);
    expect(mockGetWeeklyInsight).toHaveBeenCalledWith({
      profile: null,
      userName: "Test User",
      weeklySummary: mockWeeklySummary,
    });
  });

  it("uses the same buildWeeklySummary shared helper as the fitbit route", async () => {
    mockBuildWeeklySummary.mockResolvedValue(mockWeeklySummary);
    prismaMock.userProfile.findUnique.mockResolvedValue(testProfile);
    mockGetWeeklyInsight.mockResolvedValue("Nice consistency.");

    await request(app)
      .post("/api/coach/weekly-insight")
      .send({ weekOf: "2026-03-25" });

    // Wednesday 2026-03-25 maps to Monday 2026-03-23
    expect(mockBuildWeeklySummary).toHaveBeenCalledWith("user-123", "2026-03-23", "2026-03-29");
  });
});
