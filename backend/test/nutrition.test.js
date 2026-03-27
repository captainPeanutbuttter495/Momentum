// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── Mocks ─────────────────────────────────────────────────────────

const { mockCheckJwt, mockAttachUser, prismaMock } = vi.hoisted(() => {
  const mockCheckJwt = vi.fn((req, res, next) => next());
  const mockAttachUser = vi.fn((req, res, next) => next());

  const prismaMock = {
    customFood: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    foodLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  return { mockCheckJwt, mockAttachUser, prismaMock };
});

const mockSearchFoods = vi.hoisted(() => vi.fn());
const mockGetFoodDetails = vi.hoisted(() => vi.fn());
const mockScanNutritionLabel = vi.hoisted(() => vi.fn());
const mockUploadToS3 = vi.hoisted(() => vi.fn());
const mockDeleteFromS3 = vi.hoisted(() => vi.fn());

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

// Mock USDA API
vi.mock("../lib/usda-api.js", () => ({
  searchFoods: mockSearchFoods,
  getFoodDetails: mockGetFoodDetails,
}));

// Mock nutrition label scanner
vi.mock("../lib/nutrition-label-scanner.js", () => ({
  scanNutritionLabel: mockScanNutritionLabel,
}));

// Mock S3
vi.mock("../lib/s3.js", () => ({
  uploadToS3: mockUploadToS3,
  deleteFromS3: mockDeleteFromS3,
  extractS3Key: vi.fn((url) => (url ? url.split(".com/")[1] || null : null)),
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

const usdaFood = {
  fdcId: "171077",
  description: "Egg, whole, raw",
  brandName: null,
  servingSize: 50,
  servingUnit: "1 egg",
  calories: 72,
  proteinG: 6.3,
  carbsG: 0.4,
  fatG: 4.8,
  dataType: "Survey (FNDDS)",
};

const storedCustomFood = {
  id: "cf-1",
  userId: "user-123",
  name: "Kirkland Protein Bar",
  brand: "Kirkland",
  servingSize: 60,
  servingUnit: "g",
  calories: 190,
  proteinG: 21,
  carbsG: 22,
  fatG: 7,
  photoUrl: "https://momentum-uploads.s3.us-east-1.amazonaws.com/nutrition-labels/user-123/abc.jpg",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validCustomFoodInput = {
  name: "Kirkland Protein Bar",
  brand: "Kirkland",
  servingSize: 60,
  servingUnit: "g",
  calories: 190,
  proteinG: 21,
  carbsG: 22,
  fatG: 7,
};

const validFoodLogInput = {
  date: "2026-03-25",
  mealCategory: "BREAKFAST",
  foodName: "Egg, whole, raw",
  fdcId: "171077",
  servingQty: 2,
  servingSize: 50,
  servingUnit: "1 egg",
  calories: 144,
  proteinG: 12.6,
  carbsG: 0.8,
  fatG: 9.6,
};

const storedFoodLog = {
  id: "fl-1",
  userId: "user-123",
  ...validFoodLogInput,
  customFoodId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const storedProfile = {
  id: "profile-1",
  userId: "user-123",
  dailyCalorieTarget: 2000,
  targetWeightLbs: 180,
  proteinPct: 36,
  carbPct: 40,
  fatPct: 24,
};

// ─── Helpers ────────────────────────────────────────────────────────

function authedRequest() {
  mockAttachUser.mockImplementation((req, res, next) => {
    req.user = testUser;
    next();
  });
}

function unauthRequest() {
  mockAttachUser.mockImplementation((req, res, next) => {
    req.user = null;
    next();
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("Nutrition Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedRequest();
  });

  // ─── Search ─────────────────────────────────────────────────────

  describe("GET /api/nutrition/search", () => {
    it("returns merged USDA + custom results with source field", async () => {
      mockSearchFoods.mockResolvedValue([usdaFood]);
      prismaMock.customFood.findMany.mockResolvedValue([storedCustomFood]);

      const res = await request(app).get("/api/nutrition/search?q=egg");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].source).toBe("custom");
      expect(res.body[0].customFoodId).toBe("cf-1");
      expect(res.body[1].source).toBe("usda");
      expect(res.body[1].fdcId).toBe("171077");
    });

    it("returns only custom foods when customOnly=true", async () => {
      prismaMock.customFood.findMany.mockResolvedValue([storedCustomFood]);

      const res = await request(app).get("/api/nutrition/search?q=kirkland&customOnly=true");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].source).toBe("custom");
      expect(mockSearchFoods).not.toHaveBeenCalled();
    });

    it("returns 400 when no query provided", async () => {
      const res = await request(app).get("/api/nutrition/search");
      expect(res.status).toBe(400);
    });

    it("returns custom foods even when USDA fails", async () => {
      mockSearchFoods.mockRejectedValue(new Error("USDA down"));
      prismaMock.customFood.findMany.mockResolvedValue([storedCustomFood]);

      const res = await request(app).get("/api/nutrition/search?q=protein");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].source).toBe("custom");
    });

    it("asserts exact Prisma call shape for custom food search", async () => {
      mockSearchFoods.mockResolvedValue([]);
      prismaMock.customFood.findMany.mockResolvedValue([]);

      await request(app).get("/api/nutrition/search?q=test");

      expect(prismaMock.customFood.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          name: { contains: "test", mode: "insensitive" },
        },
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  // ─── Food Details ───────────────────────────────────────────────

  describe("GET /api/nutrition/food/:fdcId", () => {
    it("returns USDA food details", async () => {
      mockGetFoodDetails.mockResolvedValue(usdaFood);

      const res = await request(app).get("/api/nutrition/food/171077");

      expect(res.status).toBe(200);
      expect(res.body.fdcId).toBe("171077");
      expect(mockGetFoodDetails).toHaveBeenCalledWith("171077");
    });

    it("returns 500 on USDA error", async () => {
      mockGetFoodDetails.mockRejectedValue(new Error("USDA error"));

      const res = await request(app).get("/api/nutrition/food/999");
      expect(res.status).toBe(500);
    });
  });

  // ─── Custom Foods CRUD ──────────────────────────────────────────

  describe("POST /api/nutrition/custom-foods", () => {
    it("creates custom food with valid data", async () => {
      prismaMock.customFood.create.mockResolvedValue({ id: "cf-new", ...storedCustomFood });

      const res = await request(app)
        .post("/api/nutrition/custom-foods")
        .send(validCustomFoodInput);

      expect(res.status).toBe(201);
      expect(prismaMock.customFood.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          name: "Kirkland Protein Bar",
          brand: "Kirkland",
          servingSize: 60,
          servingUnit: "g",
          calories: 190,
          proteinG: 21,
          carbsG: 22,
          fatG: 7,
          photoUrl: null,
        },
      });
    });

    it("creates custom food with photo upload", async () => {
      mockUploadToS3.mockResolvedValue("https://momentum-uploads.s3.us-east-1.amazonaws.com/nutrition-labels/user-123/test.jpg");
      prismaMock.customFood.create.mockResolvedValue(storedCustomFood);

      const res = await request(app)
        .post("/api/nutrition/custom-foods")
        .send({
          ...validCustomFoodInput,
          photoBase64: "iVBORw0KGgo=",
          photoMediaType: "image/jpeg",
        });

      expect(res.status).toBe(201);
      expect(mockUploadToS3).toHaveBeenCalled();
    });

    it("returns 400 for invalid data", async () => {
      const res = await request(app)
        .post("/api/nutrition/custom-foods")
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(prismaMock.customFood.create).not.toHaveBeenCalled();
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.customFood.create.mockRejectedValue(new Error("DB down"));

      const res = await request(app)
        .post("/api/nutrition/custom-foods")
        .send(validCustomFoodInput);

      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/nutrition/custom-foods", () => {
    it("returns user's custom foods", async () => {
      prismaMock.customFood.findMany.mockResolvedValue([storedCustomFood]);

      const res = await request(app).get("/api/nutrition/custom-foods");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(prismaMock.customFood.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  describe("PUT /api/nutrition/custom-foods/:id", () => {
    it("updates custom food with valid data", async () => {
      prismaMock.customFood.findUnique.mockResolvedValue(storedCustomFood);
      prismaMock.customFood.update.mockResolvedValue({ ...storedCustomFood, calories: 200 });

      const res = await request(app)
        .put("/api/nutrition/custom-foods/cf-1")
        .send({ ...validCustomFoodInput, calories: 200 });

      expect(res.status).toBe(200);
      expect(prismaMock.customFood.update).toHaveBeenCalledWith({
        where: { id: "cf-1" },
        data: expect.objectContaining({ calories: 200 }),
      });
    });

    it("returns 404 for another user's food", async () => {
      prismaMock.customFood.findUnique.mockResolvedValue({ ...storedCustomFood, userId: "other-user" });

      const res = await request(app)
        .put("/api/nutrition/custom-foods/cf-1")
        .send(validCustomFoodInput);

      expect(res.status).toBe(404);
      expect(prismaMock.customFood.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/nutrition/custom-foods/:id", () => {
    it("deletes custom food and S3 photo", async () => {
      prismaMock.customFood.findUnique.mockResolvedValue(storedCustomFood);
      prismaMock.customFood.delete.mockResolvedValue(storedCustomFood);

      const res = await request(app).delete("/api/nutrition/custom-foods/cf-1");

      expect(res.status).toBe(200);
      expect(mockDeleteFromS3).toHaveBeenCalled();
      expect(prismaMock.customFood.delete).toHaveBeenCalledWith({ where: { id: "cf-1" } });
    });

    it("returns 404 for another user's food", async () => {
      prismaMock.customFood.findUnique.mockResolvedValue({ ...storedCustomFood, userId: "other-user" });

      const res = await request(app).delete("/api/nutrition/custom-foods/cf-1");

      expect(res.status).toBe(404);
      expect(prismaMock.customFood.delete).not.toHaveBeenCalled();
    });
  });

  // ─── Label Scan ─────────────────────────────────────────────────

  describe("POST /api/nutrition/custom-foods/scan", () => {
    it("returns extracted nutrition data", async () => {
      mockScanNutritionLabel.mockResolvedValue({
        name: "Kirkland Protein Bar",
        brand: "Kirkland",
        servingSize: 60,
        servingUnit: "g",
        calories: 190,
        proteinG: 21,
        carbsG: 22,
        fatG: 7,
      });

      const res = await request(app)
        .post("/api/nutrition/custom-foods/scan")
        .send({ photoBase64: "iVBORw0KGgo=", mediaType: "image/jpeg" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Kirkland Protein Bar");
      expect(mockScanNutritionLabel).toHaveBeenCalledWith("iVBORw0KGgo=", "image/jpeg");
    });

    it("returns 400 when no photo provided", async () => {
      const res = await request(app)
        .post("/api/nutrition/custom-foods/scan")
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 500 when Claude API fails", async () => {
      mockScanNutritionLabel.mockRejectedValue(new Error("Claude error"));

      const res = await request(app)
        .post("/api/nutrition/custom-foods/scan")
        .send({ photoBase64: "abc", mediaType: "image/jpeg" });

      expect(res.status).toBe(500);
    });
  });

  // ─── Food Log CRUD ──────────────────────────────────────────────

  describe("POST /api/nutrition/logs", () => {
    it("creates food log entry with exact Prisma call shape", async () => {
      prismaMock.foodLog.create.mockResolvedValue(storedFoodLog);

      const res = await request(app)
        .post("/api/nutrition/logs")
        .send(validFoodLogInput);

      expect(res.status).toBe(201);
      expect(prismaMock.foodLog.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          date: "2026-03-25",
          mealCategory: "BREAKFAST",
          foodName: "Egg, whole, raw",
          fdcId: "171077",
          customFoodId: null,
          servingQty: 2,
          servingSize: 50,
          servingUnit: "1 egg",
          calories: 144,
          proteinG: 12.6,
          carbsG: 0.8,
          fatG: 9.6,
        },
      });
    });

    it("returns 400 for invalid meal category", async () => {
      const res = await request(app)
        .post("/api/nutrition/logs")
        .send({ ...validFoodLogInput, mealCategory: "BRUNCH" });

      expect(res.status).toBe(400);
      expect(prismaMock.foodLog.create).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid date format", async () => {
      const res = await request(app)
        .post("/api/nutrition/logs")
        .send({ ...validFoodLogInput, date: "March 25" });

      expect(res.status).toBe(400);
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.foodLog.create.mockRejectedValue(new Error("DB down"));

      const res = await request(app)
        .post("/api/nutrition/logs")
        .send(validFoodLogInput);

      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/nutrition/logs", () => {
    it("returns food logs for a date with exact Prisma call shape", async () => {
      prismaMock.foodLog.findMany.mockResolvedValue([storedFoodLog]);

      const res = await request(app).get("/api/nutrition/logs?date=2026-03-25");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(prismaMock.foodLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123", date: "2026-03-25" },
        orderBy: { createdAt: "asc" },
        include: { customFood: true },
      });
    });

    it("returns 400 for invalid date", async () => {
      const res = await request(app).get("/api/nutrition/logs?date=bad");
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/nutrition/logs/:id", () => {
    it("updates food log entry", async () => {
      prismaMock.foodLog.findUnique.mockResolvedValue(storedFoodLog);
      prismaMock.foodLog.update.mockResolvedValue({ ...storedFoodLog, servingQty: 3 });

      const res = await request(app)
        .put("/api/nutrition/logs/fl-1")
        .send({ servingQty: 3, calories: 216, proteinG: 18.9, carbsG: 1.2, fatG: 14.4 });

      expect(res.status).toBe(200);
    });

    it("returns 404 for another user's log", async () => {
      prismaMock.foodLog.findUnique.mockResolvedValue({ ...storedFoodLog, userId: "other-user" });

      const res = await request(app)
        .put("/api/nutrition/logs/fl-1")
        .send({ servingQty: 3 });

      expect(res.status).toBe(404);
      expect(prismaMock.foodLog.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/nutrition/logs/:id", () => {
    it("deletes food log entry", async () => {
      prismaMock.foodLog.findUnique.mockResolvedValue(storedFoodLog);
      prismaMock.foodLog.delete.mockResolvedValue(storedFoodLog);

      const res = await request(app).delete("/api/nutrition/logs/fl-1");

      expect(res.status).toBe(200);
      expect(prismaMock.foodLog.delete).toHaveBeenCalledWith({ where: { id: "fl-1" } });
    });

    it("returns 404 for another user's log", async () => {
      prismaMock.foodLog.findUnique.mockResolvedValue({ ...storedFoodLog, userId: "other-user" });

      const res = await request(app).delete("/api/nutrition/logs/fl-1");

      expect(res.status).toBe(404);
      expect(prismaMock.foodLog.delete).not.toHaveBeenCalled();
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.foodLog.findUnique.mockResolvedValue(storedFoodLog);
      prismaMock.foodLog.delete.mockRejectedValue(new Error("DB down"));

      const res = await request(app).delete("/api/nutrition/logs/fl-1");

      expect(res.status).toBe(500);
    });
  });

  // ─── Summary ────────────────────────────────────────────────────

  describe("GET /api/nutrition/summary", () => {
    it("returns consumed totals and targets", async () => {
      prismaMock.foodLog.findMany.mockResolvedValue([storedFoodLog]);
      prismaMock.userProfile.findUnique.mockResolvedValue(storedProfile);

      const res = await request(app).get("/api/nutrition/summary?date=2026-03-25");

      expect(res.status).toBe(200);
      expect(res.body.date).toBe("2026-03-25");
      expect(res.body.consumed.calories).toBe(144);
      expect(res.body.targets.calories).toBe(2000);
      expect(res.body.targets.proteinG).toBeDefined();
      expect(res.body.logs).toHaveLength(1);
    });

    it("returns empty summary when no logs exist", async () => {
      prismaMock.foodLog.findMany.mockResolvedValue([]);
      prismaMock.userProfile.findUnique.mockResolvedValue(storedProfile);

      const res = await request(app).get("/api/nutrition/summary?date=2026-03-25");

      expect(res.status).toBe(200);
      expect(res.body.consumed.calories).toBe(0);
    });

    it("returns 404 when no profile exists", async () => {
      prismaMock.foodLog.findMany.mockResolvedValue([]);
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/api/nutrition/summary?date=2026-03-25");

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid date", async () => {
      const res = await request(app).get("/api/nutrition/summary?date=bad");
      expect(res.status).toBe(400);
    });
  });
});
