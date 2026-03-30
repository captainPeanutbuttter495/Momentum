// Cardio workout classification for frontend use.
// Mirrors backend CARDIO_ACTIVITY_NAMES from training-analysis.js.

const CARDIO_WORKOUT_NAMES = new Set([
  // Running
  "run", "running", "outdoor run", "treadmill", "treadmill run",
  "indoor run", "trail run", "jog", "jogging",
  // Walking
  "walk", "walking", "outdoor walk", "indoor walk", "treadmill walk",
  // Cycling
  "bike", "biking", "cycling", "outdoor bike", "indoor bike", "spinning", "spin",
  // Swimming
  "swim", "swimming", "pool swim", "open water swim",
  // Other cardio
  "elliptical", "stair stepper", "stairmaster", "rowing", "rower",
  "hike", "hiking",
]);

export function isCardioWorkoutName(name) {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  if (CARDIO_WORKOUT_NAMES.has(normalized)) return true;
  for (const cardio of CARDIO_WORKOUT_NAMES) {
    if (normalized.includes(cardio)) return true;
  }
  return false;
}
