/**
 * Mifflin-St Jeor BMR calculation.
 * Male:   10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
 * Female: 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
 */
export function calculateBMR({ weightLbs, heightFeet, heightInches, age, gender }) {
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFeet * 12 + heightInches) * 2.54;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "MALE" ? base + 5 : base - 161;
}

export function calculateTDEE(bmr, activityLevel) {
  return bmr * activityLevel;
}

/**
 * For LOSE_WEIGHT: weeklyRateLbs is lbs/week (0.5, 1, 1.5, 2) → daily deficit = rate × 500
 * For GAIN_MUSCLE: weeklyRateLbs is daily surplus in calories (250, 500)
 * For MAINTAIN: returns TDEE
 */
export function calculateDailyCalorieTarget({ tdee, goal, weeklyRateLbs }) {
  if (goal === "MAINTAIN") return Math.round(tdee);
  if (goal === "LOSE_WEIGHT") {
    const dailyDeficit = (weeklyRateLbs * 3500) / 7;
    return Math.round(tdee - dailyDeficit);
  }
  // GAIN_MUSCLE — weeklyRateLbs is daily surplus in cal
  return Math.round(tdee + weeklyRateLbs);
}

/**
 * Bodyweight-based macro calculation:
 * Protein: 0.9g per lb of target weight (muscle preservation)
 * Fat: 0.3g per lb of target weight (hormone health floor)
 * Carbs: remaining calories ÷ 4
 */
export function getMacroSplit({ dailyCalories, targetWeightLbs }) {
  const proteinGrams = Math.round(targetWeightLbs * 0.9);
  const fatGrams = Math.round(targetWeightLbs * 0.3);

  const proteinCals = proteinGrams * 4;
  const fatCals = fatGrams * 9;
  const carbCals = Math.max(dailyCalories - proteinCals - fatCals, 0);
  const carbGrams = Math.round(carbCals / 4);

  const proteinPct = Math.round((proteinCals / dailyCalories) * 100);
  const fatPct = Math.round((fatCals / dailyCalories) * 100);
  const carbPct = Math.max(100 - proteinPct - fatPct, 0);

  return { proteinPct, carbPct, fatPct, proteinGrams, carbGrams, fatGrams };
}

export function calculateEstimatedWeeks({ currentWeightLbs, targetWeightLbs, weeklyRateLbs }) {
  if (weeklyRateLbs === 0) return null;
  const diff = Math.abs(currentWeightLbs - targetWeightLbs);
  return Math.ceil(diff / weeklyRateLbs);
}
