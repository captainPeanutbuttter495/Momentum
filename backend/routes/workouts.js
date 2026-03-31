import { Router } from "express";
import prisma from "../db.js";
import { authenticated, requireUser } from "../middleware/auth.js";
import { insightCache } from "./coach.js";
import { parseWorkoutText } from "../lib/workout-parser.js";

const router = Router();

// ─── Validation ──────────────────────────────────────────────────

function validateTemplate(body) {
  const errors = [];
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("name is required");
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    errors.push("description is required");
  }

  return errors;
}

function validateWorkoutLog(body) {
  const errors = [];
  const { date, description, fitbitWorkoutName } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("date must be in YYYY-MM-DD format");
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    errors.push("description is required");
  }
  if (!fitbitWorkoutName || typeof fitbitWorkoutName !== "string" || fitbitWorkoutName.trim().length === 0) {
    errors.push("fitbitWorkoutName is required");
  }

  return errors;
}

// ─── Template Routes ─────────────────────────────────────────────

// GET /api/workouts/templates
router.get("/templates", authenticated, requireUser, async (req, res) => {
  try {
    const templates = await prisma.workoutTemplate.findMany({
      where: { userId: req.user.id },
      include: { exercises: { orderBy: { position: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/workouts/templates
router.post("/templates", authenticated, requireUser, async (req, res) => {
  try {
    const errors = validateTemplate(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join("; ") });
    }

    const { name, description } = req.body;

    // Parse the description into structured exercises via Claude
    const exercises = await parseWorkoutText(description);

    const template = await prisma.workoutTemplate.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        description: description.trim(),
        exercises: {
          create: exercises.map((ex, i) => ({
            name: ex.name,
            weightLbs: ex.weightLbs,
            sets: ex.sets,
            reps: ex.reps,
            position: i,
          })),
        },
      },
      include: { exercises: { orderBy: { position: "asc" } } },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/workouts/templates/:id
router.put("/templates/:id", authenticated, requireUser, async (req, res) => {
  try {
    const existing = await prisma.workoutTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Template not found" });
    }

    const errors = validateTemplate(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join("; ") });
    }

    const { name, description } = req.body;

    // Re-parse the description into structured exercises
    const exercises = await parseWorkoutText(description);

    // Delete existing exercises and recreate
    await prisma.workoutTemplateExercise.deleteMany({
      where: { templateId: req.params.id },
    });

    const template = await prisma.workoutTemplate.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        description: description.trim(),
        exercises: {
          create: exercises.map((ex, i) => ({
            name: ex.name,
            weightLbs: ex.weightLbs,
            sets: ex.sets,
            reps: ex.reps,
            position: i,
          })),
        },
      },
      include: { exercises: { orderBy: { position: "asc" } } },
    });

    res.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/workouts/templates/:id
router.delete("/templates/:id", authenticated, requireUser, async (req, res) => {
  try {
    const existing = await prisma.workoutTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Template not found" });
    }

    await prisma.workoutTemplate.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Template deleted" });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Workout Log Routes ─────────────────────────────────────────

// GET /api/workouts/logs/:date
router.get("/logs/:date", authenticated, requireUser, async (req, res) => {
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    const logs = await prisma.workoutLog.findMany({
      where: { userId: req.user.id, date },
      include: { exercises: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching workout logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/workouts/logs — upsert on (userId, date, fitbitWorkoutName)
router.post("/logs", authenticated, requireUser, async (req, res) => {
  try {
    const errors = validateWorkoutLog(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join("; ") });
    }

    const { date, description, fitbitWorkoutName, templateId, notes } = req.body;

    // Verify template belongs to user if provided
    if (templateId) {
      const template = await prisma.workoutTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template || template.userId !== req.user.id) {
        return res.status(400).json({ error: "Invalid template" });
      }
    }

    // Parse the description into structured exercises via Claude
    const exercises = await parseWorkoutText(description);

    // Upsert: if a log already exists for this user/date/workout, update it
    const log = await prisma.workoutLog.upsert({
      where: {
        userId_date_fitbitWorkoutName: {
          userId: req.user.id,
          date,
          fitbitWorkoutName,
        },
      },
      create: {
        userId: req.user.id,
        date,
        description: description.trim(),
        fitbitWorkoutName,
        templateId: templateId || null,
        notes: notes || null,
        exercises: {
          create: exercises.map((ex, i) => ({
            name: ex.name,
            weightLbs: ex.weightLbs,
            sets: ex.sets,
            reps: ex.reps,
            position: i,
          })),
        },
      },
      update: {
        description: description.trim(),
        templateId: templateId || null,
        notes: notes || null,
        exercises: {
          deleteMany: {},
          create: exercises.map((ex, i) => ({
            name: ex.name,
            weightLbs: ex.weightLbs,
            sets: ex.sets,
            reps: ex.reps,
            position: i,
          })),
        },
      },
      include: { exercises: { orderBy: { position: "asc" } } },
    });

    // Invalidate coach recap cache for this date
    insightCache.delete(`${req.user.id}:${date}:recap`);

    res.status(200).json(log);
  } catch (error) {
    console.error("Error logging workout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/workouts/logs/:id
router.delete("/logs/:id", authenticated, requireUser, async (req, res) => {
  try {
    const existing = await prisma.workoutLog.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Workout log not found" });
    }

    await prisma.workoutLog.delete({
      where: { id: req.params.id },
    });

    // Invalidate coach recap cache for this date
    insightCache.delete(`${req.user.id}:${existing.date}:recap`);

    res.json({ message: "Workout log deleted" });
  } catch (error) {
    console.error("Error deleting workout log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/workouts/history?days=30
router.get("/history", authenticated, requireUser, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const startDateStr = `${year}-${month}-${day}`;

    const logs = await prisma.workoutLog.findMany({
      where: {
        userId: req.user.id,
        date: { gte: startDateStr },
      },
      include: { exercises: { orderBy: { position: "asc" } } },
      orderBy: { date: "desc" },
    });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching workout history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/workouts/history/month?month=2026-03
router.get("/history/month", authenticated, requireUser, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "month query param required (YYYY-MM)" });
    }
    const monthInt = parseInt(month.split("-")[1], 10);
    if (monthInt < 1 || monthInt > 12) {
      return res.status(400).json({ error: "month must be between 01 and 12" });
    }

    const startDate = `${month}-01`;
    const [yearStr, monthStr] = month.split("-");
    const lastDay = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;

    const logs = await prisma.workoutLog.findMany({
      where: {
        userId: req.user.id,
        date: { gte: startDate, lte: endDate },
      },
      include: { exercises: { orderBy: { position: "asc" } } },
      orderBy: { date: "desc" },
    });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching monthly workout history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/workouts/parse — standalone text parsing (no save)
router.post("/parse", authenticated, requireUser, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required" });
    }

    const exercises = await parseWorkoutText(text);
    res.json({ exercises });
  } catch (error) {
    console.error("Error parsing workout text:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
