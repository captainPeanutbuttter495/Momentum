// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── Mocks ─────────────────────────────────────────────────────────

const { mockCheckJwt, mockAttachUser, prismaMock } = vi.hoisted(() => {
  const mockCheckJwt = vi.fn((req, res, next) => next());
  const mockAttachUser = vi.fn((req, res, next) => next());

  const prismaMock = {
    fitbitToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  return { mockCheckJwt, mockAttachUser, prismaMock };
});

const mockExchangeCodeForTokens = vi.hoisted(() => vi.fn());
const mockGetFitbitSleepData = vi.hoisted(() => vi.fn());
const mockGetFitbitActivityData = vi.hoisted(() => vi.fn());
const mockGetFitbitHeartRateData = vi.hoisted(() => vi.fn());

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
  exchangeCodeForTokens: mockExchangeCodeForTokens,
  getFitbitSleepData: mockGetFitbitSleepData,
  getFitbitActivityData: mockGetFitbitActivityData,
  getFitbitHeartRateData: mockGetFitbitHeartRateData,
}));

// ─── Import app after mocks ────────────────────────────────────────

const { default: app } = await import("../app.js");

// ─── Test Data ─────────────────────────────────────────────────────

const testUser = {
  id: "user-123",
  auth0Id: "google-oauth2|123456789",
  email: "test@gmail.com",
  name: "Test User",
  role: "USER",
  isActive: true,
};

const testFitbitToken = {
  id: "token-123",
  userId: "user-123",
  fitbitUserId: "FITBIT_USER_1",
  accessToken: "fitbit-access-token",
  refreshToken: "fitbit-refresh-token",
  expiresAt: new Date(Date.now() + 3600 * 1000),
  scope: "sleep activity heartrate",
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

describe("Fitbit Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asUser();
  });

  // ── GET /api/fitbit/auth-url ──────────────────────────────────

  describe("GET /api/fitbit/auth-url", () => {
    it("returns a Fitbit OAuth URL with correct scopes", async () => {
      const res = await request(app).get("/api/fitbit/auth-url");

      expect(res.status).toBe(200);
      expect(res.body.url).toContain("https://www.fitbit.com/oauth2/authorize");
      expect(res.body.url).toContain("scope=sleep+activity+heartrate");
      expect(res.body.url).toContain("response_type=code");
      expect(res.body.url).toContain("state=");
    });
  });

  // ── GET /api/fitbit/status ────────────────────────────────────

  describe("GET /api/fitbit/status", () => {
    it("returns connected: true when token exists", async () => {
      prismaMock.fitbitToken.findUnique.mockResolvedValue(testFitbitToken);

      const res = await request(app).get("/api/fitbit/status");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        connected: true,
        fitbitUserId: "FITBIT_USER_1",
      });
      expect(prismaMock.fitbitToken.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-123" },
      });
    });

    it("returns connected: false when no token exists", async () => {
      prismaMock.fitbitToken.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/api/fitbit/status");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.fitbitToken.findUnique.mockRejectedValue(new Error("DB down"));

      const res = await request(app).get("/api/fitbit/status");

      expect(res.status).toBe(500);
      expect(prismaMock.fitbitToken.findUnique).toHaveBeenCalled();
    });
  });

  // ── DELETE /api/fitbit/disconnect ─────────────────────────────

  describe("DELETE /api/fitbit/disconnect", () => {
    it("deletes the Fitbit token and returns disconnected: true", async () => {
      prismaMock.fitbitToken.delete.mockResolvedValue(testFitbitToken);

      const res = await request(app).delete("/api/fitbit/disconnect");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ disconnected: true });
      expect(prismaMock.fitbitToken.delete).toHaveBeenCalledWith({
        where: { userId: "user-123" },
      });
    });

    it("returns disconnected: true even if token not found (P2025)", async () => {
      prismaMock.fitbitToken.delete.mockRejectedValue({ code: "P2025" });

      const res = await request(app).delete("/api/fitbit/disconnect");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ disconnected: true });
    });

    it("returns 500 on unexpected Prisma error", async () => {
      prismaMock.fitbitToken.delete.mockRejectedValue(new Error("DB down"));

      const res = await request(app).delete("/api/fitbit/disconnect");

      expect(res.status).toBe(500);
      expect(prismaMock.fitbitToken.delete).toHaveBeenCalled();
    });
  });

  // ── GET /api/fitbit/sleep/:date ───────────────────────────────

  describe("GET /api/fitbit/sleep/:date", () => {
    const mockSleepData = {
      date: "2026-03-16",
      summary: {
        totalMinutesAsleep: 420,
        totalTimeInBed: 480,
        stages: { deep: 90, light: 180, rem: 120, wake: 30 },
      },
      sleepLog: [],
    };

    it("returns sleep data for a valid date", async () => {
      mockGetFitbitSleepData.mockResolvedValue(mockSleepData);

      const res = await request(app).get("/api/fitbit/sleep/2026-03-16");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockSleepData);
      expect(mockGetFitbitSleepData).toHaveBeenCalledWith("user-123", "2026-03-16");
    });

    it("rejects invalid date format", async () => {
      const res = await request(app).get("/api/fitbit/sleep/03-16-2026");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
      expect(mockGetFitbitSleepData).not.toHaveBeenCalled();
    });

    it("returns 401 when Fitbit not connected", async () => {
      mockGetFitbitSleepData.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));

      const res = await request(app).get("/api/fitbit/sleep/2026-03-16");

      expect(res.status).toBe(401);
    });

    it("returns 502 on Fitbit API error", async () => {
      mockGetFitbitSleepData.mockRejectedValue(new Error("FITBIT_API_ERROR"));

      const res = await request(app).get("/api/fitbit/sleep/2026-03-16");

      expect(res.status).toBe(502);
    });
  });

  // ── GET /api/fitbit/activity/:date ────────────────────────────

  describe("GET /api/fitbit/activity/:date", () => {
    const mockActivityData = {
      date: "2026-03-16",
      steps: 8500,
      distance: 3.8,
      caloriesOut: 2100,
      activeMinutes: {
        sedentary: 600,
        lightlyActive: 180,
        fairlyActive: 30,
        veryActive: 15,
      },
    };

    it("returns activity data for a valid date", async () => {
      mockGetFitbitActivityData.mockResolvedValue(mockActivityData);

      const res = await request(app).get("/api/fitbit/activity/2026-03-16");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockActivityData);
      expect(mockGetFitbitActivityData).toHaveBeenCalledWith("user-123", "2026-03-16");
    });

    it("rejects invalid date format", async () => {
      const res = await request(app).get("/api/fitbit/activity/not-a-date");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
      expect(mockGetFitbitActivityData).not.toHaveBeenCalled();
    });

    it("returns 401 when Fitbit not connected", async () => {
      mockGetFitbitActivityData.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));

      const res = await request(app).get("/api/fitbit/activity/2026-03-16");

      expect(res.status).toBe(401);
    });

    it("returns 401 when re-auth required", async () => {
      mockGetFitbitActivityData.mockRejectedValue(new Error("FITBIT_REAUTH_REQUIRED"));

      const res = await request(app).get("/api/fitbit/activity/2026-03-16");

      expect(res.status).toBe(401);
    });

    it("returns 502 on Fitbit API error", async () => {
      mockGetFitbitActivityData.mockRejectedValue(new Error("FITBIT_API_ERROR"));

      const res = await request(app).get("/api/fitbit/activity/2026-03-16");

      expect(res.status).toBe(502);
    });
  });

  // ── GET /api/fitbit/heartrate/:date ───────────────────────────

  describe("GET /api/fitbit/heartrate/:date", () => {
    const mockHeartRateData = {
      date: "2026-03-16",
      restingHeartRate: 62,
      zones: [
        { name: "Out of Range", min: 30, max: 104, minutes: 1200, caloriesOut: 900 },
        { name: "Fat Burn", min: 104, max: 134, minutes: 45, caloriesOut: 300 },
        { name: "Cardio", min: 134, max: 167, minutes: 12, caloriesOut: 120 },
        { name: "Peak", min: 167, max: 220, minutes: 3, caloriesOut: 40 },
      ],
    };

    it("returns heart rate data for a valid date", async () => {
      mockGetFitbitHeartRateData.mockResolvedValue(mockHeartRateData);

      const res = await request(app).get("/api/fitbit/heartrate/2026-03-16");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockHeartRateData);
      expect(mockGetFitbitHeartRateData).toHaveBeenCalledWith("user-123", "2026-03-16");
    });

    it("rejects invalid date format", async () => {
      const res = await request(app).get("/api/fitbit/heartrate/bad");

      expect(res.status).toBe(400);
      expect(mockGetFitbitHeartRateData).not.toHaveBeenCalled();
    });

    it("returns 401 when Fitbit not connected", async () => {
      mockGetFitbitHeartRateData.mockRejectedValue(new Error("FITBIT_NOT_CONNECTED"));

      const res = await request(app).get("/api/fitbit/heartrate/2026-03-16");

      expect(res.status).toBe(401);
    });

    it("returns 502 on Fitbit API error", async () => {
      mockGetFitbitHeartRateData.mockRejectedValue(new Error("FITBIT_API_ERROR"));

      const res = await request(app).get("/api/fitbit/heartrate/2026-03-16");

      expect(res.status).toBe(502);
    });
  });

  // ── GET /api/fitbit/callback ──────────────────────────────────

  describe("GET /api/fitbit/callback", () => {
    it("redirects to error on missing params", async () => {
      const res = await request(app).get("/api/fitbit/callback");

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        "momentum://fitbit/error?reason=missing_params"
      );
    });

    it("redirects to error on invalid state", async () => {
      const res = await request(app).get(
        "/api/fitbit/callback?code=abc&state=invalid-state"
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        "momentum://fitbit/error?reason=invalid_state"
      );
    });
  });
});
