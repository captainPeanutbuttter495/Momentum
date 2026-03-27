const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const USDA_API_KEY = process.env.USDA_API_KEY;

// In-memory cache: key → { data, timestamp }
const searchCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  if (cached) searchCache.delete(key);
  return null;
}

function setCache(key, data) {
  searchCache.set(key, { data, timestamp: Date.now() });
}

// Normalize USDA unit abbreviations to readable form
const UNIT_MAP = {
  GRM: "g",
  grm: "g",
  G: "g",
  g: "g",
  MLT: "ml",
  mlt: "ml",
  ML: "ml",
  ml: "ml",
  OZ: "oz",
  oz: "oz",
  LB: "lb",
  lb: "lb",
  TSP: "tsp",
  TBSP: "tbsp",
  CUP: "cup",
};

function normalizeUnit(unit) {
  if (!unit) return "g";
  return UNIT_MAP[unit] || unit.toLowerCase();
}

function extractNutrient(foodNutrients, nutrientId) {
  const n = foodNutrients.find((fn) => fn.nutrientId === nutrientId);
  return n ? Math.round(n.value * 10) / 10 : 0;
}

/**
 * Pick the best household measure from foodMeasures.
 * Prefers single-item measures ("1 egg", "1 banana", "1 breast") over
 * volume measures ("1 cup") or vague ones ("Quantity not specified").
 * Returns { label, gramWeight } or null if none useful.
 */
function pickBestMeasure(foodMeasures) {
  if (!foodMeasures || foodMeasures.length === 0) return null;

  // Filter out "Quantity not specified" and entries with no gram weight
  const usable = foodMeasures.filter(
    (m) =>
      m.gramWeight > 0 &&
      m.disseminationText &&
      m.disseminationText.indexOf("not specified") === -1,
  );

  if (usable.length === 0) return null;

  // Prefer single-item measures (not cups/oz/slices) — these are most intuitive
  const singleItem = usable.find((m) => {
    const t = m.disseminationText.toLowerCase();
    return (
      t.indexOf("cup") === -1 &&
      t.indexOf(" oz") === -1 &&
      t.indexOf("slice") === -1 &&
      t.indexOf("tbsp") === -1 &&
      t.indexOf("tsp") === -1
    );
  });

  return singleItem || usable[0];
}

function transformFood(food) {
  const nutrients = food.foodNutrients || [];

  // Nutrients from USDA are per 100g
  const calsPer100g = extractNutrient(nutrients, 1008);
  const protPer100g = extractNutrient(nutrients, 1003);
  const carbsPer100g = extractNutrient(nutrients, 1005);
  const fatPer100g = extractNutrient(nutrients, 1004);

  // For Survey (FNDDS) foods: use household measure if available
  const measure = pickBestMeasure(food.foodMeasures);
  const isFNDDS = food.dataType === "Survey (FNDDS)";

  let servingSize, servingUnit, calories, proteinG, carbsG, fatG;

  if (isFNDDS && measure) {
    // Convert per-100g nutrients to per-measure
    const factor = measure.gramWeight / 100;
    servingSize = Math.round(measure.gramWeight * 10) / 10;
    servingUnit = measure.disseminationText;
    calories = Math.round(calsPer100g * factor);
    proteinG = Math.round(protPer100g * factor * 10) / 10;
    carbsG = Math.round(carbsPer100g * factor * 10) / 10;
    fatG = Math.round(fatPer100g * factor * 10) / 10;
  } else {
    // Branded foods: servingSize from label, nutrients already per-serving
    const rawSize = food.servingSize || 100;
    servingSize = Math.round(rawSize * 10) / 10;
    servingUnit = normalizeUnit(food.servingSizeUnit) || "g";
    calories = calsPer100g;
    proteinG = protPer100g;
    carbsG = carbsPer100g;
    fatG = fatPer100g;
  }

  return {
    fdcId: String(food.fdcId),
    description: food.description || "",
    brandName: food.brandName || food.brandOwner || null,
    servingSize,
    servingUnit,
    calories,
    proteinG,
    carbsG,
    fatG,
    dataType: food.dataType || null,
  };
}

async function fetchUSDA(query, pageSize, dataTypes) {
  const response = await fetch(
    `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageSize, dataType: dataTypes }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`USDA API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return (data.foods || []).map(transformFood);
}

export async function searchFoods(query, pageSize = 25) {
  if (!USDA_API_KEY) {
    throw new Error("USDA_API_KEY is not configured");
  }

  const cacheKey = `search:${query.toLowerCase().trim()}:${pageSize}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // For short queries (1-2 words), also search for the raw/whole version
  // so basic ingredients like "Egg, whole, raw" appear at the top
  const words = query.trim().split(/\s+/);
  const needsRawSearch = words.length <= 2;

  const searches = [
    fetchUSDA(query, pageSize, ["Survey (FNDDS)", "Branded"]),
  ];
  if (needsRawSearch) {
    searches.push(
      fetchUSDA(`${query} raw`, 5, ["Survey (FNDDS)"]).catch(() => []),
    );
  }

  const [mainResults, rawResults = []] = await Promise.all(searches);

  // Merge: raw basics first (deduped), then main results
  // Filter raw results to only include items that match the original query
  const queryLower = query.toLowerCase().trim();
  const filteredRaw = rawResults.filter((item) =>
    item.description.toLowerCase().includes(queryLower),
  );

  const seen = new Set();
  const merged = [];

  for (const item of filteredRaw) {
    if (!seen.has(item.fdcId)) {
      seen.add(item.fdcId);
      merged.push(item);
    }
  }
  for (const item of mainResults) {
    if (!seen.has(item.fdcId)) {
      seen.add(item.fdcId);
      merged.push(item);
    }
  }

  // Within the remaining results, sort generic before branded
  const rawIds = new Set(filteredRaw.map((r) => r.fdcId));
  merged.sort((a, b) => {
    // Raw basics always first
    const aRaw = rawIds.has(a.fdcId) ? 0 : 1;
    const bRaw = rawIds.has(b.fdcId) ? 0 : 1;
    if (aRaw !== bRaw) return aRaw - bRaw;
    // Then generic before branded
    const aGeneric = a.dataType === "Survey (FNDDS)" ? 0 : 1;
    const bGeneric = b.dataType === "Survey (FNDDS)" ? 0 : 1;
    return aGeneric - bGeneric;
  });

  const results = merged.slice(0, pageSize);
  setCache(cacheKey, results);
  return results;
}

export async function getFoodDetails(fdcId) {
  if (!USDA_API_KEY) {
    throw new Error("USDA_API_KEY is not configured");
  }

  const cacheKey = `food:${fdcId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`,
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`USDA API error: ${response.status} ${text}`);
  }

  const food = await response.json();
  const result = transformFood(food);

  setCache(cacheKey, result);
  return result;
}
