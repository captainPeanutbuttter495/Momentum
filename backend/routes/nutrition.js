import { Router } from "express";
import { randomUUID } from "crypto";
import prisma from "../db.js";
import { authenticated, requireUser } from "../middleware/auth.js";
import { searchFoods, getFoodDetails } from "../lib/usda-api.js";
import { scanNutritionLabel } from "../lib/nutrition-label-scanner.js";
import { uploadToS3, deleteFromS3, extractS3Key } from "../lib/s3.js";
import { getMacroSplit } from "../lib/nutrition-calc.js";

const router = Router();

// ─── Validation ──────────────────────────────────────────────────

const VALID_MEAL_CATEGORIES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

function validateCustomFood(body) {
  const errors = [];
  const { name, servingSize, servingUnit, calories, proteinG, carbsG, fatG } =
    body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("name is required");
  }
  if (servingSize == null || typeof servingSize !== "number" || servingSize <= 0) {
    errors.push("servingSize must be a positive number");
  }
  if (
    !servingUnit ||
    typeof servingUnit !== "string" ||
    servingUnit.trim().length === 0
  ) {
    errors.push("servingUnit is required");
  }
  if (calories == null || typeof calories !== "number" || calories < 0) {
    errors.push("calories must be a non-negative number");
  }
  if (proteinG == null || typeof proteinG !== "number" || proteinG < 0) {
    errors.push("proteinG must be a non-negative number");
  }
  if (carbsG == null || typeof carbsG !== "number" || carbsG < 0) {
    errors.push("carbsG must be a non-negative number");
  }
  if (fatG == null || typeof fatG !== "number" || fatG < 0) {
    errors.push("fatG must be a non-negative number");
  }

  return errors;
}

function validateFoodLog(body) {
  const errors = [];
  const {
    date,
    mealCategory,
    foodName,
    servingQty,
    servingSize,
    servingUnit,
    calories,
    proteinG,
    carbsG,
    fatG,
  } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("date must be in YYYY-MM-DD format");
  }
  if (!mealCategory || !VALID_MEAL_CATEGORIES.includes(mealCategory)) {
    errors.push(
      `mealCategory must be one of: ${VALID_MEAL_CATEGORIES.join(", ")}`,
    );
  }
  if (!foodName || typeof foodName !== "string" || foodName.trim().length === 0) {
    errors.push("foodName is required");
  }
  if (servingQty == null || typeof servingQty !== "number" || servingQty <= 0) {
    errors.push("servingQty must be a positive number");
  }
  if (servingSize == null || typeof servingSize !== "number" || servingSize <= 0) {
    errors.push("servingSize must be a positive number");
  }
  if (
    !servingUnit ||
    typeof servingUnit !== "string" ||
    servingUnit.trim().length === 0
  ) {
    errors.push("servingUnit is required");
  }
  if (calories == null || typeof calories !== "number" || calories < 0) {
    errors.push("calories must be a non-negative number");
  }
  if (proteinG == null || typeof proteinG !== "number" || proteinG < 0) {
    errors.push("proteinG must be a non-negative number");
  }
  if (carbsG == null || typeof carbsG !== "number" || carbsG < 0) {
    errors.push("carbsG must be a non-negative number");
  }
  if (fatG == null || typeof fatG !== "number" || fatG < 0) {
    errors.push("fatG must be a non-negative number");
  }

  return errors;
}

// ─── Search ──────────────────────────────────────────────────────

// GET /api/nutrition/search?q=<query>&customOnly=true|false
router.get("/search", authenticated, requireUser, async (req, res) => {
  const { q, customOnly } = req.query;

  if (!q || typeof q !== "string" || q.trim().length === 0) {
    return res.status(400).json({ error: "query parameter 'q' is required" });
  }

  const query = q.trim();
  const isCustomOnly = customOnly === "true";

  try {
    const customFoodsPromise = prisma.customFood.findMany({
      where: {
        userId: req.user.id,
        name: { contains: query, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
    });

    let usdaResults = [];
    if (!isCustomOnly) {
      try {
        const usda = await searchFoods(query);
        usdaResults = usda.map((food) => ({ ...food, source: "usda" }));
      } catch (err) {
        console.error("USDA search error (returning custom only):", err.message);
      }
    }

    const customFoods = await customFoodsPromise;
    const customResults = customFoods.map((food) => ({
      customFoodId: food.id,
      description: food.name,
      brandName: food.brand,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      photoUrl: food.photoUrl,
      source: "custom",
    }));

    res.json([...customResults, ...usdaResults]);
  } catch (error) {
    console.error("Error searching foods:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/nutrition/food/:fdcId
router.get("/food/:fdcId", authenticated, requireUser, async (req, res) => {
  try {
    const food = await getFoodDetails(req.params.fdcId);
    res.json(food);
  } catch (error) {
    console.error("Error fetching food details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Custom Foods ────────────────────────────────────────────────

// POST /api/nutrition/custom-foods
router.post("/custom-foods", authenticated, requireUser, async (req, res) => {
  const {
    name,
    brand,
    servingSize,
    servingUnit,
    calories,
    proteinG,
    carbsG,
    fatG,
    photoBase64,
    photoMediaType,
  } = req.body;

  const errors = validateCustomFood({
    name,
    servingSize,
    servingUnit,
    calories,
    proteinG,
    carbsG,
    fatG,
  });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    let photoUrl = null;
    if (photoBase64 && photoMediaType) {
      const ext = photoMediaType.includes("png") ? "png" : "jpg";
      const key = `nutrition-labels/${req.user.id}/${randomUUID()}.${ext}`;
      const buffer = Buffer.from(photoBase64, "base64");
      photoUrl = await uploadToS3(buffer, key, photoMediaType);
    }

    const customFood = await prisma.customFood.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        brand: brand?.trim() || null,
        servingSize,
        servingUnit: servingUnit.trim(),
        calories,
        proteinG,
        carbsG,
        fatG,
        photoUrl,
      },
    });

    res.status(201).json(customFood);
  } catch (error) {
    console.error("Error creating custom food:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/nutrition/custom-foods
router.get("/custom-foods", authenticated, requireUser, async (req, res) => {
  try {
    const customFoods = await prisma.customFood.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
    });

    res.json(customFoods);
  } catch (error) {
    console.error("Error fetching custom foods:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/nutrition/custom-foods/:id
router.put(
  "/custom-foods/:id",
  authenticated,
  requireUser,
  async (req, res) => {
    try {
      const existing = await prisma.customFood.findUnique({
        where: { id: req.params.id },
      });

      if (!existing || existing.userId !== req.user.id) {
        return res.status(404).json({ error: "Custom food not found" });
      }

      const {
        name,
        brand,
        servingSize,
        servingUnit,
        calories,
        proteinG,
        carbsG,
        fatG,
      } = req.body;

      const errors = validateCustomFood({
        name,
        servingSize,
        servingUnit,
        calories,
        proteinG,
        carbsG,
        fatG,
      });
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      const updated = await prisma.customFood.update({
        where: { id: req.params.id },
        data: {
          name: name.trim(),
          brand: brand?.trim() || null,
          servingSize,
          servingUnit: servingUnit.trim(),
          calories,
          proteinG,
          carbsG,
          fatG,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating custom food:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// DELETE /api/nutrition/custom-foods/:id
router.delete(
  "/custom-foods/:id",
  authenticated,
  requireUser,
  async (req, res) => {
    try {
      const existing = await prisma.customFood.findUnique({
        where: { id: req.params.id },
      });

      if (!existing || existing.userId !== req.user.id) {
        return res.status(404).json({ error: "Custom food not found" });
      }

      if (existing.photoUrl) {
        const key = extractS3Key(existing.photoUrl);
        if (key) {
          try {
            await deleteFromS3(key);
          } catch (err) {
            console.error("Error deleting S3 photo:", err.message);
          }
        }
      }

      await prisma.customFood.delete({ where: { id: req.params.id } });

      res.json({ message: "Custom food deleted" });
    } catch (error) {
      console.error("Error deleting custom food:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/nutrition/custom-foods/scan
router.post(
  "/custom-foods/scan",
  authenticated,
  requireUser,
  async (req, res) => {
    const { photoBase64, mediaType } = req.body;

    if (!photoBase64 || !mediaType) {
      return res
        .status(400)
        .json({ error: "photoBase64 and mediaType are required" });
    }

    try {
      const extracted = await scanNutritionLabel(photoBase64, mediaType);
      res.json(extracted);
    } catch (error) {
      console.error("Error scanning nutrition label:", error);
      res.status(500).json({ error: "Failed to scan nutrition label" });
    }
  },
);

// ─── Food Log ────────────────────────────────────────────────────

// POST /api/nutrition/logs
router.post("/logs", authenticated, requireUser, async (req, res) => {
  const {
    date,
    mealCategory,
    foodName,
    fdcId,
    customFoodId,
    servingQty,
    servingSize,
    servingUnit,
    calories,
    proteinG,
    carbsG,
    fatG,
  } = req.body;

  const errors = validateFoodLog({
    date,
    mealCategory,
    foodName,
    servingQty,
    servingSize,
    servingUnit,
    calories,
    proteinG,
    carbsG,
    fatG,
  });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (customFoodId) {
    const customFood = await prisma.customFood.findUnique({
      where: { id: customFoodId },
    });
    if (!customFood || customFood.userId !== req.user.id) {
      return res.status(400).json({ error: "Invalid customFoodId" });
    }
  }

  try {
    const entry = await prisma.foodLog.create({
      data: {
        userId: req.user.id,
        date,
        mealCategory,
        foodName: foodName.trim(),
        fdcId: fdcId || null,
        customFoodId: customFoodId || null,
        servingQty,
        servingSize,
        servingUnit: servingUnit.trim(),
        calories,
        proteinG,
        carbsG,
        fatG,
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error("Error creating food log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/nutrition/logs?date=YYYY-MM-DD
router.get("/logs", authenticated, requireUser, async (req, res) => {
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  try {
    const logs = await prisma.foodLog.findMany({
      where: { userId: req.user.id, date },
      orderBy: { createdAt: "asc" },
      include: { customFood: true },
    });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching food logs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/nutrition/logs/:id
router.put("/logs/:id", authenticated, requireUser, async (req, res) => {
  try {
    const existing = await prisma.foodLog.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Food log entry not found" });
    }

    const {
      mealCategory,
      foodName,
      servingQty,
      servingSize,
      servingUnit,
      calories,
      proteinG,
      carbsG,
      fatG,
    } = req.body;

    const errors = validateFoodLog({
      date: existing.date,
      mealCategory: mealCategory || existing.mealCategory,
      foodName: foodName || existing.foodName,
      servingQty: servingQty ?? existing.servingQty,
      servingSize: servingSize ?? existing.servingSize,
      servingUnit: servingUnit || existing.servingUnit,
      calories: calories ?? existing.calories,
      proteinG: proteinG ?? existing.proteinG,
      carbsG: carbsG ?? existing.carbsG,
      fatG: fatG ?? existing.fatG,
    });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const updated = await prisma.foodLog.update({
      where: { id: req.params.id },
      data: {
        mealCategory: mealCategory || existing.mealCategory,
        foodName: foodName?.trim() || existing.foodName,
        servingQty: servingQty ?? existing.servingQty,
        servingSize: servingSize ?? existing.servingSize,
        servingUnit: servingUnit?.trim() || existing.servingUnit,
        calories: calories ?? existing.calories,
        proteinG: proteinG ?? existing.proteinG,
        carbsG: carbsG ?? existing.carbsG,
        fatG: fatG ?? existing.fatG,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating food log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/nutrition/logs/:id
router.delete("/logs/:id", authenticated, requireUser, async (req, res) => {
  try {
    const existing = await prisma.foodLog.findUnique({
      where: { id: req.params.id },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Food log entry not found" });
    }

    await prisma.foodLog.delete({ where: { id: req.params.id } });

    res.json({ message: "Food log entry deleted" });
  } catch (error) {
    console.error("Error deleting food log:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Summary ─────────────────────────────────────────────────────

// GET /api/nutrition/summary?date=YYYY-MM-DD
router.get("/summary", authenticated, requireUser, async (req, res) => {
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  try {
    const [logs, profile] = await Promise.all([
      prisma.foodLog.findMany({
        where: { userId: req.user.id, date },
        orderBy: { createdAt: "asc" },
        include: { customFood: true },
      }),
      prisma.userProfile.findUnique({
        where: { userId: req.user.id },
      }),
    ]);

    if (!profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const consumed = {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    };

    for (const log of logs) {
      consumed.calories += log.calories;
      consumed.proteinG += log.proteinG;
      consumed.carbsG += log.carbsG;
      consumed.fatG += log.fatG;
    }

    consumed.calories = Math.round(consumed.calories);
    consumed.proteinG = Math.round(consumed.proteinG * 10) / 10;
    consumed.carbsG = Math.round(consumed.carbsG * 10) / 10;
    consumed.fatG = Math.round(consumed.fatG * 10) / 10;

    const macros = getMacroSplit({
      dailyCalories: profile.dailyCalorieTarget,
      targetWeightLbs: profile.targetWeightLbs,
    });

    const targets = {
      calories: profile.dailyCalorieTarget,
      proteinG: macros.proteinGrams,
      carbsG: macros.carbGrams,
      fatG: macros.fatGrams,
    };

    res.json({ date, consumed, targets, logs });
  } catch (error) {
    console.error("Error fetching nutrition summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
