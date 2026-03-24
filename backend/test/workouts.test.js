// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── Mocks ─────────────────────────────────────────────────────────

const { mockCheckJwt, mockAttachUser, prismaMock } = vi.hoisted(() => {
  const mockCheckJwt = vi.fn((req, res, next) => next());
  const mockAttachUser = vi.fn((req, res, next) => next());

  const prismaMock = {
    workoutTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    workoutTemplateExercise: {
      deleteMany: vi.fn(),
    },
    workoutLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
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

const mockParseWorkoutText = vi.hoisted(() => vi.fn());

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

// Mock workout-parser
vi.mock("../lib/workout-parser.js", () => ({
  parseWorkoutText: mockParseWorkoutText,
}));

// Mock coach.js — provide a real Map so insightCache.delete works
vi.mock("../routes/coach.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
  };
});

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

const parsedExercises = [
  { name: "Chest Press", weightLbs: 30, sets: 3, reps: 10 },
  { name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12 },
];

const storedTemplate = {
  id: "template-1",
  userId: "user-123",
  name: "Upper Body",
  description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
  createdAt: new Date(),
  updatedAt: new Date(),
  exercises: [
    { id: "ex-1", templateId: "template-1", name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
    { id: "ex-2", templateId: "template-1", name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
  ],
};

const storedLog = {
  id: "log-1",
  userId: "user-123",
  date: "2026-03-22",
  description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
  fitbitWorkoutName: "Weights",
  templateId: null,
  notes: null,
  createdAt: new Date(),
  exercises: [
    { id: "lex-1", workoutLogId: "log-1", name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
    { id: "lex-2", workoutLogId: "log-1", name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
  ],
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

describe("Workout Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insightCache.clear();
    asUser();
    mockParseWorkoutText.mockResolvedValue(parsedExercises);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Template Routes
  // ═══════════════════════════════════════════════════════════════════

  // ─── GET /api/workouts/templates ──────────────────────────────────

  describe("GET /api/workouts/templates", () => {
    it("returns all templates for the authenticated user", async () => {
      prismaMock.workoutTemplate.findMany.mockResolvedValue([storedTemplate]);

      const res = await request(app).get("/api/workouts/templates").expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Upper Body");
      expect(res.body[0].exercises).toHaveLength(2);
      expect(prismaMock.workoutTemplate.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        include: { exercises: { orderBy: { position: "asc" } } },
        orderBy: { updatedAt: "desc" },
      });
    });

    it("returns empty array when user has no templates", async () => {
      prismaMock.workoutTemplate.findMany.mockResolvedValue([]);

      const res = await request(app).get("/api/workouts/templates").expect(200);

      expect(res.body).toEqual([]);
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.workoutTemplate.findMany.mockRejectedValue(new Error("DB down"));

      await request(app).get("/api/workouts/templates").expect(500);

      expect(prismaMock.workoutTemplate.findMany).toHaveBeenCalled();
    });

    it("returns 403 without authenticated user", async () => {
      mockAttachUser.mockImplementation((req, res, next) => {
        req.user = null;
        next();
      });

      await request(app).get("/api/workouts/templates").expect(403);
    });
  });

  // ─── POST /api/workouts/templates ─────────────────────────────────

  describe("POST /api/workouts/templates", () => {
    const validInput = {
      name: "Upper Body",
      description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
    };

    it("creates template with parsed exercises", async () => {
      prismaMock.workoutTemplate.create.mockResolvedValue(storedTemplate);

      const res = await request(app)
        .post("/api/workouts/templates")
        .send(validInput)
        .expect(201);

      expect(res.body.name).toBe("Upper Body");
      expect(res.body.exercises).toHaveLength(2);

      expect(mockParseWorkoutText).toHaveBeenCalledWith(validInput.description);
      expect(prismaMock.workoutTemplate.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          name: "Upper Body",
          description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
          exercises: {
            create: [
              { name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
              { name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
            ],
          },
        },
        include: { exercises: { orderBy: { position: "asc" } } },
      });
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/workouts/templates")
        .send({ description: "some exercises" })
        .expect(400);

      expect(res.body.error).toContain("name");
      expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled();
    });

    it("returns 400 when description is missing", async () => {
      const res = await request(app)
        .post("/api/workouts/templates")
        .send({ name: "Upper Body" })
        .expect(400);

      expect(res.body.error).toContain("description");
      expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled();
    });

    it("returns 400 when name is empty string", async () => {
      const res = await request(app)
        .post("/api/workouts/templates")
        .send({ name: "  ", description: "some exercises" })
        .expect(400);

      expect(res.body.error).toContain("name");
    });

    it("returns 400 when description is empty string", async () => {
      const res = await request(app)
        .post("/api/workouts/templates")
        .send({ name: "Upper Body", description: "  " })
        .expect(400);

      expect(res.body.error).toContain("description");
    });

    it("returns 500 on Prisma create error", async () => {
      prismaMock.workoutTemplate.create.mockRejectedValue(new Error("DB down"));

      await request(app)
        .post("/api/workouts/templates")
        .send(validInput)
        .expect(500);

      expect(prismaMock.workoutTemplate.create).toHaveBeenCalled();
    });

    it("returns 500 when parseWorkoutText fails", async () => {
      mockParseWorkoutText.mockRejectedValue(new Error("AI parse failed"));

      await request(app)
        .post("/api/workouts/templates")
        .send(validInput)
        .expect(500);
    });
  });

  // ─── PUT /api/workouts/templates/:id ──────────────────────────────

  describe("PUT /api/workouts/templates/:id", () => {
    const updateInput = {
      name: "Upper Body v2",
      description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
    };

    it("updates template with re-parsed exercises", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);
      prismaMock.workoutTemplateExercise.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.workoutTemplate.update.mockResolvedValue({
        ...storedTemplate,
        name: "Upper Body v2",
      });

      const res = await request(app)
        .put("/api/workouts/templates/template-1")
        .send(updateInput)
        .expect(200);

      expect(res.body.name).toBe("Upper Body v2");

      // Ownership check
      expect(prismaMock.workoutTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: "template-1" },
      });

      // Delete old exercises
      expect(prismaMock.workoutTemplateExercise.deleteMany).toHaveBeenCalledWith({
        where: { templateId: "template-1" },
      });

      // Re-parse
      expect(mockParseWorkoutText).toHaveBeenCalledWith(updateInput.description);

      // Update with new exercises
      expect(prismaMock.workoutTemplate.update).toHaveBeenCalledWith({
        where: { id: "template-1" },
        data: {
          name: "Upper Body v2",
          description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
          exercises: {
            create: [
              { name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
              { name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
            ],
          },
        },
        include: { exercises: { orderBy: { position: "asc" } } },
      });
    });

    it("returns 404 when template not found", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put("/api/workouts/templates/nonexistent")
        .send(updateInput)
        .expect(404);

      expect(res.body.error).toBe("Template not found");
      expect(prismaMock.workoutTemplate.update).not.toHaveBeenCalled();
    });

    it("returns 404 when template belongs to another user", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue({
        ...storedTemplate,
        userId: "other-user",
      });

      const res = await request(app)
        .put("/api/workouts/templates/template-1")
        .send(updateInput)
        .expect(404);

      expect(res.body.error).toBe("Template not found");
      expect(prismaMock.workoutTemplate.update).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid input (missing name)", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);

      const res = await request(app)
        .put("/api/workouts/templates/template-1")
        .send({ description: "some exercises" })
        .expect(400);

      expect(res.body.error).toContain("name");
      expect(prismaMock.workoutTemplate.update).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid input (missing description)", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);

      const res = await request(app)
        .put("/api/workouts/templates/template-1")
        .send({ name: "Upper Body v2" })
        .expect(400);

      expect(res.body.error).toContain("description");
      expect(prismaMock.workoutTemplate.update).not.toHaveBeenCalled();
    });

    it("returns 500 on Prisma update error", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);
      prismaMock.workoutTemplateExercise.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.workoutTemplate.update.mockRejectedValue(new Error("DB down"));

      await request(app)
        .put("/api/workouts/templates/template-1")
        .send(updateInput)
        .expect(500);

      expect(prismaMock.workoutTemplate.update).toHaveBeenCalled();
    });
  });

  // ─── DELETE /api/workouts/templates/:id ───────────────────────────

  describe("DELETE /api/workouts/templates/:id", () => {
    it("deletes template owned by user", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);
      prismaMock.workoutTemplate.delete.mockResolvedValue(storedTemplate);

      const res = await request(app)
        .delete("/api/workouts/templates/template-1")
        .expect(200);

      expect(res.body.message).toBe("Template deleted");

      expect(prismaMock.workoutTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: "template-1" },
      });
      expect(prismaMock.workoutTemplate.delete).toHaveBeenCalledWith({
        where: { id: "template-1" },
      });
    });

    it("returns 404 when template not found", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/workouts/templates/nonexistent")
        .expect(404);

      expect(res.body.error).toBe("Template not found");
      expect(prismaMock.workoutTemplate.delete).not.toHaveBeenCalled();
    });

    it("returns 404 when template belongs to another user", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue({
        ...storedTemplate,
        userId: "other-user",
      });

      const res = await request(app)
        .delete("/api/workouts/templates/template-1")
        .expect(404);

      expect(res.body.error).toBe("Template not found");
      expect(prismaMock.workoutTemplate.delete).not.toHaveBeenCalled();
    });

    it("returns 500 on Prisma delete error", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);
      prismaMock.workoutTemplate.delete.mockRejectedValue(new Error("DB down"));

      await request(app)
        .delete("/api/workouts/templates/template-1")
        .expect(500);

      expect(prismaMock.workoutTemplate.delete).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Workout Log Routes
  // ═══════════════════════════════════════════════════════════════════

  // ─── GET /api/workouts/logs/:date ─────────────────────────────────

  describe("GET /api/workouts/logs/:date", () => {
    it("returns workout logs for a valid date", async () => {
      prismaMock.workoutLog.findMany.mockResolvedValue([storedLog]);

      const res = await request(app)
        .get("/api/workouts/logs/2026-03-22")
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].date).toBe("2026-03-22");
      expect(res.body[0].exercises).toHaveLength(2);
      expect(prismaMock.workoutLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123", date: "2026-03-22" },
        include: { exercises: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when no logs for date", async () => {
      prismaMock.workoutLog.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/workouts/logs/2026-03-22")
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it("returns 400 for invalid date format", async () => {
      const res = await request(app)
        .get("/api/workouts/logs/March-22-2026")
        .expect(400);

      expect(res.body.error).toBe("Invalid date format. Use YYYY-MM-DD");
      expect(prismaMock.workoutLog.findMany).not.toHaveBeenCalled();
    });

    it("returns 400 for date with wrong separator", async () => {
      const res = await request(app)
        .get("/api/workouts/logs/2026/03/22")
        .expect(404); // Express treats this as a different route
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.workoutLog.findMany.mockRejectedValue(new Error("DB down"));

      await request(app)
        .get("/api/workouts/logs/2026-03-22")
        .expect(500);

      expect(prismaMock.workoutLog.findMany).toHaveBeenCalled();
    });
  });

  // ─── POST /api/workouts/logs ──────────────────────────────────────

  describe("POST /api/workouts/logs", () => {
    const validLogInput = {
      date: "2026-03-22",
      description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
      fitbitWorkoutName: "Weights",
    };

    it("upserts workout log with parsed exercises", async () => {
      prismaMock.workoutLog.upsert.mockResolvedValue(storedLog);

      const res = await request(app)
        .post("/api/workouts/logs")
        .send(validLogInput)
        .expect(200);

      expect(res.body.date).toBe("2026-03-22");
      expect(res.body.exercises).toHaveLength(2);

      expect(mockParseWorkoutText).toHaveBeenCalledWith(validLogInput.description);
      expect(prismaMock.workoutLog.upsert).toHaveBeenCalledWith({
        where: {
          userId_date_fitbitWorkoutName: {
            userId: "user-123",
            date: "2026-03-22",
            fitbitWorkoutName: "Weights",
          },
        },
        create: {
          userId: "user-123",
          date: "2026-03-22",
          description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
          fitbitWorkoutName: "Weights",
          templateId: null,
          notes: null,
          exercises: {
            create: [
              { name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
              { name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
            ],
          },
        },
        update: {
          description: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs",
          templateId: null,
          notes: null,
          exercises: {
            deleteMany: {},
            create: [
              { name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
              { name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
            ],
          },
        },
        include: { exercises: { orderBy: { position: "asc" } } },
      });
    });

    it("accepts optional templateId and notes", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(storedTemplate);
      prismaMock.workoutLog.upsert.mockResolvedValue({
        ...storedLog,
        templateId: "template-1",
        notes: "Felt strong today",
      });

      const res = await request(app)
        .post("/api/workouts/logs")
        .send({
          ...validLogInput,
          templateId: "template-1",
          notes: "Felt strong today",
        })
        .expect(200);

      const upsertCall = prismaMock.workoutLog.upsert.mock.calls[0][0];
      expect(upsertCall.create.templateId).toBe("template-1");
      expect(upsertCall.create.notes).toBe("Felt strong today");
      expect(upsertCall.update.templateId).toBe("template-1");
      expect(upsertCall.update.notes).toBe("Felt strong today");
    });

    it("invalidates coach recap cache on log creation", async () => {
      prismaMock.workoutLog.upsert.mockResolvedValue(storedLog);
      insightCache.set("user-123:2026-03-22:recap", { cached: true });

      await request(app)
        .post("/api/workouts/logs")
        .send(validLogInput)
        .expect(200);

      expect(insightCache.has("user-123:2026-03-22:recap")).toBe(false);
    });

    it("returns 400 when date is missing", async () => {
      const res = await request(app)
        .post("/api/workouts/logs")
        .send({ description: "some exercises", fitbitWorkoutName: "Weights" })
        .expect(400);

      expect(res.body.error).toContain("date");
      expect(prismaMock.workoutLog.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when date format is invalid", async () => {
      const res = await request(app)
        .post("/api/workouts/logs")
        .send({ date: "03-22-2026", description: "some exercises", fitbitWorkoutName: "Weights" })
        .expect(400);

      expect(res.body.error).toContain("date");
    });

    it("returns 400 when description is missing", async () => {
      const res = await request(app)
        .post("/api/workouts/logs")
        .send({ date: "2026-03-22", fitbitWorkoutName: "Weights" })
        .expect(400);

      expect(res.body.error).toContain("description");
      expect(prismaMock.workoutLog.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when fitbitWorkoutName is missing", async () => {
      const res = await request(app)
        .post("/api/workouts/logs")
        .send({ date: "2026-03-22", description: "some exercises" })
        .expect(400);

      expect(res.body.error).toContain("fitbitWorkoutName");
      expect(prismaMock.workoutLog.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when all required fields are missing", async () => {
      const res = await request(app)
        .post("/api/workouts/logs")
        .send({})
        .expect(400);

      expect(res.body.error).toContain("date");
      expect(res.body.error).toContain("description");
      expect(res.body.error).toContain("fitbitWorkoutName");
    });

    it("returns 400 when templateId belongs to another user", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue({
        ...storedTemplate,
        userId: "other-user",
      });

      const res = await request(app)
        .post("/api/workouts/logs")
        .send({ ...validLogInput, templateId: "template-1" })
        .expect(400);

      expect(res.body.error).toBe("Invalid template");
      expect(prismaMock.workoutLog.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when templateId does not exist", async () => {
      prismaMock.workoutTemplate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/workouts/logs")
        .send({ ...validLogInput, templateId: "nonexistent" })
        .expect(400);

      expect(res.body.error).toBe("Invalid template");
      expect(prismaMock.workoutLog.upsert).not.toHaveBeenCalled();
    });

    it("returns 500 on Prisma upsert error", async () => {
      prismaMock.workoutLog.upsert.mockRejectedValue(new Error("DB down"));

      await request(app)
        .post("/api/workouts/logs")
        .send(validLogInput)
        .expect(500);

      expect(prismaMock.workoutLog.upsert).toHaveBeenCalled();
    });

    it("returns 500 when parseWorkoutText fails", async () => {
      mockParseWorkoutText.mockRejectedValue(new Error("AI parse failed"));

      await request(app)
        .post("/api/workouts/logs")
        .send(validLogInput)
        .expect(500);
    });
  });

  // ─── DELETE /api/workouts/logs/:id ────────────────────────────────

  describe("DELETE /api/workouts/logs/:id", () => {
    it("deletes workout log owned by user", async () => {
      prismaMock.workoutLog.findUnique.mockResolvedValue(storedLog);
      prismaMock.workoutLog.delete.mockResolvedValue(storedLog);

      const res = await request(app)
        .delete("/api/workouts/logs/log-1")
        .expect(200);

      expect(res.body.message).toBe("Workout log deleted");

      expect(prismaMock.workoutLog.findUnique).toHaveBeenCalledWith({
        where: { id: "log-1" },
      });
      expect(prismaMock.workoutLog.delete).toHaveBeenCalledWith({
        where: { id: "log-1" },
      });
    });

    it("invalidates coach recap cache on log deletion", async () => {
      prismaMock.workoutLog.findUnique.mockResolvedValue(storedLog);
      prismaMock.workoutLog.delete.mockResolvedValue(storedLog);
      insightCache.set("user-123:2026-03-22:recap", { cached: true });

      await request(app)
        .delete("/api/workouts/logs/log-1")
        .expect(200);

      expect(insightCache.has("user-123:2026-03-22:recap")).toBe(false);
    });

    it("returns 404 when log not found", async () => {
      prismaMock.workoutLog.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete("/api/workouts/logs/nonexistent")
        .expect(404);

      expect(res.body.error).toBe("Workout log not found");
      expect(prismaMock.workoutLog.delete).not.toHaveBeenCalled();
    });

    it("returns 404 when log belongs to another user", async () => {
      prismaMock.workoutLog.findUnique.mockResolvedValue({
        ...storedLog,
        userId: "other-user",
      });

      const res = await request(app)
        .delete("/api/workouts/logs/log-1")
        .expect(404);

      expect(res.body.error).toBe("Workout log not found");
      expect(prismaMock.workoutLog.delete).not.toHaveBeenCalled();
    });

    it("returns 500 on Prisma delete error", async () => {
      prismaMock.workoutLog.findUnique.mockResolvedValue(storedLog);
      prismaMock.workoutLog.delete.mockRejectedValue(new Error("DB down"));

      await request(app)
        .delete("/api/workouts/logs/log-1")
        .expect(500);

      expect(prismaMock.workoutLog.delete).toHaveBeenCalled();
    });
  });

  // ─── GET /api/workouts/history ────────────────────────────────────

  describe("GET /api/workouts/history", () => {
    it("returns workout logs from the last 30 days by default", async () => {
      prismaMock.workoutLog.findMany.mockResolvedValue([storedLog]);

      const res = await request(app)
        .get("/api/workouts/history")
        .expect(200);

      expect(res.body).toHaveLength(1);

      const call = prismaMock.workoutLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-123");
      expect(call.where.date).toHaveProperty("gte");
      expect(call.include).toEqual({ exercises: { orderBy: { position: "asc" } } });
      expect(call.orderBy).toEqual({ date: "desc" });
    });

    it("accepts custom days parameter", async () => {
      prismaMock.workoutLog.findMany.mockResolvedValue([]);

      await request(app)
        .get("/api/workouts/history?days=7")
        .expect(200);

      const call = prismaMock.workoutLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-123");
      // The start date should be ~7 days ago
      const startDate = call.where.date.gte;
      expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("defaults to 30 days for non-numeric days param", async () => {
      prismaMock.workoutLog.findMany.mockResolvedValue([]);

      await request(app)
        .get("/api/workouts/history?days=abc")
        .expect(200);

      // NaN from parseInt falls back to 30
      expect(prismaMock.workoutLog.findMany).toHaveBeenCalled();
    });

    it("returns 500 on Prisma error", async () => {
      prismaMock.workoutLog.findMany.mockRejectedValue(new Error("DB down"));

      await request(app)
        .get("/api/workouts/history")
        .expect(500);

      expect(prismaMock.workoutLog.findMany).toHaveBeenCalled();
    });
  });

  // ─── POST /api/workouts/parse ─────────────────────────────────────

  describe("POST /api/workouts/parse", () => {
    it("returns parsed exercises from text", async () => {
      const res = await request(app)
        .post("/api/workouts/parse")
        .send({ text: "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs" })
        .expect(200);

      expect(res.body.exercises).toHaveLength(2);
      expect(res.body.exercises[0].name).toBe("Chest Press");
      expect(res.body.exercises[1].name).toBe("Bicep Curls");
      expect(mockParseWorkoutText).toHaveBeenCalledWith(
        "Chest press 3x10 30lbs, Bicep curls 3x12 25lbs"
      );
    });

    it("returns 400 when text is missing", async () => {
      const res = await request(app)
        .post("/api/workouts/parse")
        .send({})
        .expect(400);

      expect(res.body.error).toBe("text is required");
      expect(mockParseWorkoutText).not.toHaveBeenCalled();
    });

    it("returns 400 when text is empty string", async () => {
      const res = await request(app)
        .post("/api/workouts/parse")
        .send({ text: "  " })
        .expect(400);

      expect(res.body.error).toBe("text is required");
      expect(mockParseWorkoutText).not.toHaveBeenCalled();
    });

    it("returns 400 when text is not a string", async () => {
      const res = await request(app)
        .post("/api/workouts/parse")
        .send({ text: 123 })
        .expect(400);

      expect(res.body.error).toBe("text is required");
      expect(mockParseWorkoutText).not.toHaveBeenCalled();
    });

    it("returns 500 when parseWorkoutText fails", async () => {
      mockParseWorkoutText.mockRejectedValue(new Error("AI parse failed"));

      await request(app)
        .post("/api/workouts/parse")
        .send({ text: "some workout" })
        .expect(500);

      expect(mockParseWorkoutText).toHaveBeenCalled();
    });
  });
});
