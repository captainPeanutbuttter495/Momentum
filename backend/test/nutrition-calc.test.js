// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalorieTarget,
  getMacroSplit,
  calculateEstimatedWeeks,
} from "../lib/nutrition-calc.js";

describe("nutrition-calc", () => {
  describe("calculateBMR", () => {
    it("calculates BMR for a male", () => {
      // 180 lbs = 81.65 kg, 5'10" = 177.8 cm, age 25
      // 10 × 81.65 + 6.25 × 177.8 - 5 × 25 + 5 = 816.5 + 1111.25 - 125 + 5 = 1807.75
      const bmr = calculateBMR({ weightLbs: 180, heightFeet: 5, heightInches: 10, age: 25, gender: "MALE" });
      expect(bmr).toBeCloseTo(1807.75, 0);
    });

    it("calculates BMR for a female", () => {
      // 140 lbs = 63.50 kg, 5'4" = 162.56 cm, age 30
      // 10 × 63.50 + 6.25 × 162.56 - 5 × 30 - 161 = 635.0 + 1016.0 - 150 - 161 = 1340.0
      const bmr = calculateBMR({ weightLbs: 140, heightFeet: 5, heightInches: 4, age: 30, gender: "FEMALE" });
      expect(bmr).toBeCloseTo(1340.0, 0);
    });

    it("handles edge case with 0 inches", () => {
      const bmr = calculateBMR({ weightLbs: 200, heightFeet: 6, heightInches: 0, age: 35, gender: "MALE" });
      expect(bmr).toBeGreaterThan(0);
    });
  });

  describe("calculateTDEE", () => {
    it("multiplies BMR by sedentary factor", () => {
      expect(calculateTDEE(1800, 1.2)).toBeCloseTo(2160, 0);
    });

    it("multiplies BMR by moderately active factor", () => {
      expect(calculateTDEE(1800, 1.55)).toBeCloseTo(2790, 0);
    });

    it("multiplies BMR by very active factor", () => {
      expect(calculateTDEE(1800, 1.725)).toBeCloseTo(3105, 0);
    });
  });

  describe("calculateDailyCalorieTarget", () => {
    it("returns TDEE for MAINTAIN", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "MAINTAIN", weeklyRateLbs: 0 })).toBe(2500);
    });

    it("subtracts 250 cal/day for 0.5 lbs/week deficit", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "LOSE_WEIGHT", weeklyRateLbs: 0.5 })).toBe(2250);
    });

    it("subtracts 500 cal/day for 1 lb/week deficit", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "LOSE_WEIGHT", weeklyRateLbs: 1 })).toBe(2000);
    });

    it("subtracts 750 cal/day for 1.5 lbs/week deficit", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "LOSE_WEIGHT", weeklyRateLbs: 1.5 })).toBe(1750);
    });

    it("subtracts 1000 cal/day for 2 lbs/week deficit", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "LOSE_WEIGHT", weeklyRateLbs: 2 })).toBe(1500);
    });

    it("adds 250 cal surplus for lean bulk", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "GAIN_MUSCLE", weeklyRateLbs: 250 })).toBe(2750);
    });

    it("adds 500 cal surplus for standard bulk", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "GAIN_MUSCLE", weeklyRateLbs: 500 })).toBe(3000);
    });
  });

  describe("getMacroSplit", () => {
    it("calculates bodyweight-based macros", () => {
      const result = getMacroSplit({ dailyCalories: 2500, targetWeightLbs: 180 });
      // Protein: 180 × 0.9 = 162g (648 cal)
      // Fat: 180 × 0.3 = 54g (486 cal)
      // Carbs: (2500 - 648 - 486) / 4 = 341.5g
      expect(result.proteinGrams).toBe(162);
      expect(result.fatGrams).toBe(54);
      expect(result.carbGrams).toBe(342);
    });

    it("returns correct percentages", () => {
      const result = getMacroSplit({ dailyCalories: 2500, targetWeightLbs: 180 });
      expect(result.proteinPct + result.carbPct + result.fatPct).toBeLessThanOrEqual(100);
      expect(result.proteinPct).toBeGreaterThan(0);
      expect(result.carbPct).toBeGreaterThan(0);
      expect(result.fatPct).toBeGreaterThan(0);
    });

    it("clamps carbs to 0 if protein + fat exceed calories", () => {
      // Very low calorie target with high target weight
      const result = getMacroSplit({ dailyCalories: 1000, targetWeightLbs: 300 });
      // Protein: 270g (1080 cal), Fat: 90g (810 cal) = 1890 cal > 1000
      expect(result.carbGrams).toBe(0);
      expect(result.carbPct).toBe(0);
    });

    it("matches user's real-world scenario", () => {
      // 266 lbs, target 220, 2649 cal/day
      const result = getMacroSplit({ dailyCalories: 2649, targetWeightLbs: 220 });
      expect(result.proteinGrams).toBe(198); // 220 × 0.9
      expect(result.fatGrams).toBe(66);      // 220 × 0.3
      expect(result.carbGrams).toBe(316);
    });
  });

  describe("calculateEstimatedWeeks", () => {
    it("calculates weeks to lose 30 lbs at 1 lb/week", () => {
      expect(calculateEstimatedWeeks({ currentWeightLbs: 210, targetWeightLbs: 180, weeklyRateLbs: 1 })).toBe(30);
    });

    it("calculates weeks to lose 46 lbs at 1.5 lbs/week", () => {
      expect(calculateEstimatedWeeks({ currentWeightLbs: 266, targetWeightLbs: 220, weeklyRateLbs: 1.5 })).toBe(31);
    });

    it("rounds up partial weeks", () => {
      expect(calculateEstimatedWeeks({ currentWeightLbs: 185, targetWeightLbs: 180, weeklyRateLbs: 2 })).toBe(3);
    });

    it("returns null when rate is 0", () => {
      expect(calculateEstimatedWeeks({ currentWeightLbs: 180, targetWeightLbs: 180, weeklyRateLbs: 0 })).toBeNull();
    });
  });
});
