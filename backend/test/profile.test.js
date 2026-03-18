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
      create: vi.fn(),
      update: vi.fn(),
    },
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

const validProfileInput = {
  goal: "LOSE_WEIGHT",
  age: 26,
  heightFeet: 5,
  heightInches: 10,
  weightLbs: 266,
  gender: "MALE",
  activityLevel: 1.55,
  targetWeightLbs: 220,
  weeklyRateLbs: 1.5,
};

const storedProfile = {
  id: "profile-123",
  userId: "user-123",
  ...validProfileInput,
  bmr: 2192.8,
  tdee: 3398.84,
  dailyCalorieTarget: 2649,
  proteinPct: 30,
  carbPct: 48,
  fatPct: 22,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function asUser() {
  mockAttachUser.mockImplementation((req, res, next) => {
    req.user = testUser;
    next();
  });
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("Profile Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asUser();
  });

  // ─── GET /api/profile ────────────────────────────────────────────

  describe("GET /api/profile", () => {
    it("returns profile when it exists", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(storedProfile);

      const res = await request(app).get("/api/profile").expect(200);

      expect(res.body.goal).toBe("LOSE_WEIGHT");
      expect(res.body.userId).toBe("user-123");
      expect(prismaMock.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-123" },
      });
    });

    it("returns 404 when profile does not exist", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/api/profile").expect(404);

      expect(res.body.error).toBe("Profile not found");
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.userProfile.findUnique.mockRejectedValue(new Error("DB down"));

      await request(app).get("/api/profile").expect(500);

      expect(prismaMock.userProfile.findUnique).toHaveBeenCalled();
    });

    it("returns 403 without authenticated user", async () => {
      mockAttachUser.mockImplementation((req, res, next) => {
        req.user = null;
        next();
      });

      await request(app).get("/api/profile").expect(403);
    });
  });

  // ─── POST /api/profile ───────────────────────────────────────────

  describe("POST /api/profile", () => {
    it("creates profile with valid data and computes BMR/TDEE/macros", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);
      prismaMock.userProfile.create.mockResolvedValue(storedProfile);

      const res = await request(app)
        .post("/api/profile")
        .send(validProfileInput)
        .expect(201);

      expect(res.body.goal).toBe("LOSE_WEIGHT");

      const createCall = prismaMock.userProfile.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe("user-123");
      expect(createCall.data.goal).toBe("LOSE_WEIGHT");
      expect(createCall.data.bmr).toBeCloseTo(2192.8, 0);
      expect(createCall.data.tdee).toBeCloseTo(3398.8, 0);
      expect(createCall.data.dailyCalorieTarget).toBe(2649);
      // Macro: protein = 220 * 0.9 = 198g (792 cal), fat = 220 * 0.3 = 66g (594 cal)
      expect(createCall.data.proteinPct).toBe(30);
      expect(createCall.data.fatPct).toBe(22);
    });

    it("returns 409 when profile already exists", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(storedProfile);

      const res = await request(app)
        .post("/api/profile")
        .send(validProfileInput)
        .expect(409);

      expect(res.body.error).toBe("Profile already exists");
      expect(prismaMock.userProfile.create).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid goal", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/profile")
        .send({ ...validProfileInput, goal: "INVALID" })
        .expect(400);

      expect(res.body.error).toContain("goal");
    });

    it("returns 400 for missing age", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/profile")
        .send({ ...validProfileInput, age: "not a number" })
        .expect(400);

      expect(res.body.error).toContain("age");
    });

    it("returns 400 for invalid activity level", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/profile")
        .send({ ...validProfileInput, activityLevel: 2.0 })
        .expect(400);

      expect(res.body.error).toContain("activityLevel");
    });

    it("returns 400 for invalid weeklyRateLbs for LOSE_WEIGHT", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/profile")
        .send({ ...validProfileInput, weeklyRateLbs: 3 })
        .expect(400);

      expect(res.body.error).toContain("weeklyRateLbs");
    });

    it("returns 400 for invalid weeklyRateLbs for GAIN_MUSCLE", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/profile")
        .send({ ...validProfileInput, goal: "GAIN_MUSCLE", weeklyRateLbs: 100 })
        .expect(400);

      expect(res.body.error).toContain("weeklyRateLbs");
    });

    it("accepts valid MAINTAIN profile with weeklyRateLbs 0", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);
      prismaMock.userProfile.create.mockResolvedValue(storedProfile);

      await request(app)
        .post("/api/profile")
        .send({ ...validProfileInput, goal: "MAINTAIN", weeklyRateLbs: 0 })
        .expect(201);

      expect(prismaMock.userProfile.create).toHaveBeenCalled();
    });

    it("returns 500 on Prisma create error", async () => {
      prismaMock.userProfile.findUnique.mockResolvedValue(null);
      prismaMock.userProfile.create.mockRejectedValue(new Error("DB down"));

      await request(app)
        .post("/api/profile")
        .send(validProfileInput)
        .expect(500);

      expect(prismaMock.userProfile.create).toHaveBeenCalled();
    });
  });

  // ─── PUT /api/profile ────────────────────────────────────────────

  describe("PUT /api/profile", () => {
    it("updates profile with valid data and recomputes values", async () => {
      const updatedInput = { ...validProfileInput, weightLbs: 250 };
      prismaMock.userProfile.update.mockResolvedValue({ ...storedProfile, weightLbs: 250 });

      const res = await request(app)
        .put("/api/profile")
        .send(updatedInput)
        .expect(200);

      const updateCall = prismaMock.userProfile.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ userId: "user-123" });
      expect(updateCall.data.weightLbs).toBe(250);
      // BMR should be recomputed for 250 lbs
      expect(updateCall.data.bmr).toBeDefined();
      expect(updateCall.data.tdee).toBeDefined();
      expect(updateCall.data.dailyCalorieTarget).toBeDefined();
    });

    it("returns 404 when profile does not exist (P2025)", async () => {
      const prismaError = new Error("Record not found");
      prismaError.code = "P2025";
      prismaMock.userProfile.update.mockRejectedValue(prismaError);

      const res = await request(app)
        .put("/api/profile")
        .send(validProfileInput)
        .expect(404);

      expect(res.body.error).toBe("Profile not found");
    });

    it("returns 400 for invalid data", async () => {
      const res = await request(app)
        .put("/api/profile")
        .send({ ...validProfileInput, gender: "OTHER" })
        .expect(400);

      expect(res.body.error).toContain("gender");
    });

    it("returns 500 on Prisma update error", async () => {
      prismaMock.userProfile.update.mockRejectedValue(new Error("DB down"));

      await request(app)
        .put("/api/profile")
        .send(validProfileInput)
        .expect(500);

      expect(prismaMock.userProfile.update).toHaveBeenCalled();
    });
  });
});
