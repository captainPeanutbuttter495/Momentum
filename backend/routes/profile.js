import { Router } from "express";
import prisma from "../db.js";
import { authenticated, requireUser } from "../middleware/auth.js";
import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalorieTarget,
  getMacroSplit,
} from "../lib/nutrition-calc.js";

const router = Router();

const VALID_GOALS = ["LOSE_WEIGHT", "MAINTAIN", "GAIN_MUSCLE"];
const VALID_GENDERS = ["MALE", "FEMALE"];
const VALID_ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725];

function validateProfileBody(body) {
  const errors = [];
  const { goal, age, heightFeet, heightInches, weightLbs, gender, activityLevel, targetWeightLbs, weeklyRateLbs } = body;

  if (!VALID_GOALS.includes(goal)) errors.push("goal must be LOSE_WEIGHT, MAINTAIN, or GAIN_MUSCLE");
  if (!Number.isInteger(age) || age < 13 || age > 120) errors.push("age must be an integer between 13 and 120");
  if (!Number.isInteger(heightFeet) || heightFeet < 3 || heightFeet > 8) errors.push("heightFeet must be an integer between 3 and 8");
  if (!Number.isInteger(heightInches) || heightInches < 0 || heightInches > 11) errors.push("heightInches must be an integer between 0 and 11");
  if (typeof weightLbs !== "number" || weightLbs < 50 || weightLbs > 1000) errors.push("weightLbs must be a number between 50 and 1000");
  if (!VALID_GENDERS.includes(gender)) errors.push("gender must be MALE or FEMALE");
  if (!VALID_ACTIVITY_LEVELS.includes(activityLevel)) errors.push("activityLevel must be 1.2, 1.375, 1.55, or 1.725");
  if (typeof targetWeightLbs !== "number" || targetWeightLbs < 50 || targetWeightLbs > 1000) errors.push("targetWeightLbs must be a number between 50 and 1000");

  if (goal === "LOSE_WEIGHT" && ![0.5, 1, 1.5, 2].includes(weeklyRateLbs)) {
    errors.push("weeklyRateLbs must be 0.5, 1, 1.5, or 2 for LOSE_WEIGHT");
  } else if (goal === "GAIN_MUSCLE" && ![250, 500].includes(weeklyRateLbs)) {
    errors.push("weeklyRateLbs must be 250 or 500 for GAIN_MUSCLE");
  } else if (goal === "MAINTAIN" && weeklyRateLbs !== 0) {
    errors.push("weeklyRateLbs must be 0 for MAINTAIN");
  }

  return errors;
}

function computeProfileFields(body) {
  const { weightLbs, heightFeet, heightInches, age, gender, activityLevel, goal, weeklyRateLbs, targetWeightLbs } = body;
  const bmr = calculateBMR({ weightLbs, heightFeet, heightInches, age, gender });
  const tdee = calculateTDEE(bmr, activityLevel);
  const dailyCalorieTarget = calculateDailyCalorieTarget({ tdee, goal, weeklyRateLbs });
  const { proteinPct, carbPct, fatPct } = getMacroSplit({ dailyCalories: dailyCalorieTarget, targetWeightLbs });
  return { bmr, tdee, dailyCalorieTarget, proteinPct, carbPct, fatPct };
}

// GET /api/profile — return profile or 404
router.get("/", authenticated, requireUser, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/profile — create profile during onboarding
router.post("/", authenticated, requireUser, async (req, res) => {
  try {
    const existing = await prisma.userProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (existing) {
      return res.status(409).json({ error: "Profile already exists" });
    }

    const errors = validateProfileBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join("; ") });
    }

    const { goal, age, heightFeet, heightInches, weightLbs, gender, activityLevel, targetWeightLbs, weeklyRateLbs } = req.body;
    const computed = computeProfileFields(req.body);

    const profile = await prisma.userProfile.create({
      data: {
        userId: req.user.id,
        goal,
        age,
        heightFeet,
        heightInches,
        weightLbs,
        gender,
        activityLevel,
        targetWeightLbs,
        weeklyRateLbs,
        ...computed,
      },
    });

    res.status(201).json(profile);
  } catch (error) {
    console.error("Error creating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/profile — update profile
router.put("/", authenticated, requireUser, async (req, res) => {
  try {
    const errors = validateProfileBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join("; ") });
    }

    const { goal, age, heightFeet, heightInches, weightLbs, gender, activityLevel, targetWeightLbs, weeklyRateLbs } = req.body;
    const computed = computeProfileFields(req.body);

    const profile = await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: {
        goal,
        age,
        heightFeet,
        heightInches,
        weightLbs,
        gender,
        activityLevel,
        targetWeightLbs,
        weeklyRateLbs,
        ...computed,
      },
    });

    res.json(profile);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
