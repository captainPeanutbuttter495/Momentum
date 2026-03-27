export async function searchFoods(api, query, customOnly = false) {
  return api.get(
    `/api/nutrition/search?q=${encodeURIComponent(query)}${customOnly ? "&customOnly=true" : ""}`,
  );
}

export async function getFoodDetails(api, fdcId) {
  return api.get(`/api/nutrition/food/${fdcId}`);
}

export async function createCustomFood(api, data) {
  return api.post("/api/nutrition/custom-foods", data);
}

export async function getCustomFoods(api) {
  return api.get("/api/nutrition/custom-foods");
}

export async function scanNutritionLabel(api, photoBase64, mediaType) {
  return api.post("/api/nutrition/custom-foods/scan", {
    photoBase64,
    mediaType,
  });
}

export async function logFood(api, entry) {
  return api.post("/api/nutrition/logs", entry);
}

export async function getFoodLog(api, date) {
  return api.get(`/api/nutrition/logs?date=${date}`);
}

export async function updateFoodLog(api, id, data) {
  return api.put(`/api/nutrition/logs/${id}`, data);
}

export async function deleteFoodLog(api, id) {
  return api.delete(`/api/nutrition/logs/${id}`);
}

export async function getDailySummary(api, date) {
  return api.get(`/api/nutrition/summary?date=${date}`);
}
