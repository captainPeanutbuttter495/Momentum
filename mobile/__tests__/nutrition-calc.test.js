import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalorieTarget,
  getMacroSplit,
  calculateEstimatedWeeks,
} from "../lib/nutrition-calc";

describe("nutrition-calc (mobile parity)", () => {
  describe("calculateBMR", () => {
    it("calculates BMR for a male", () => {
      const bmr = calculateBMR({ weightLbs: 180, heightFeet: 5, heightInches: 10, age: 25, gender: "MALE" });
      expect(bmr).toBeCloseTo(1807.75, 0);
    });

    it("calculates BMR for a female", () => {
      const bmr = calculateBMR({ weightLbs: 140, heightFeet: 5, heightInches: 4, age: 30, gender: "FEMALE" });
      expect(bmr).toBeCloseTo(1340.0, 0);
    });
  });

  describe("calculateTDEE", () => {
    it("multiplies BMR by activity level", () => {
      expect(calculateTDEE(1800, 1.55)).toBeCloseTo(2790, 0);
    });
  });

  describe("calculateDailyCalorieTarget", () => {
    it("returns TDEE for MAINTAIN", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "MAINTAIN", weeklyRateLbs: 0 })).toBe(2500);
    });

    it("subtracts deficit for LOSE_WEIGHT", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "LOSE_WEIGHT", weeklyRateLbs: 1 })).toBe(2000);
    });

    it("adds surplus for GAIN_MUSCLE", () => {
      expect(calculateDailyCalorieTarget({ tdee: 2500, goal: "GAIN_MUSCLE", weeklyRateLbs: 250 })).toBe(2750);
    });
  });

  describe("getMacroSplit", () => {
    it("calculates bodyweight-based macros matching backend", () => {
      const result = getMacroSplit({ dailyCalories: 2649, targetWeightLbs: 220 });
      expect(result.proteinGrams).toBe(198);
      expect(result.fatGrams).toBe(66);
      expect(result.carbGrams).toBe(316);
    });

    it("clamps carbs to 0 when protein + fat exceed calories", () => {
      const result = getMacroSplit({ dailyCalories: 1000, targetWeightLbs: 300 });
      expect(result.carbGrams).toBe(0);
    });
  });

  describe("calculateEstimatedWeeks", () => {
    it("calculates weeks correctly", () => {
      expect(calculateEstimatedWeeks({ currentWeightLbs: 266, targetWeightLbs: 220, weeklyRateLbs: 1.5 })).toBe(31);
    });

    it("returns null for rate 0", () => {
      expect(calculateEstimatedWeeks({ currentWeightLbs: 180, targetWeightLbs: 180, weeklyRateLbs: 0 })).toBeNull();
    });
  });
});
