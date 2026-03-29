export async function getFitbitAuthUrl(api) {
  return api.get("/api/fitbit/auth-url");
}

export async function getFitbitStatus(api) {
  return api.get("/api/fitbit/status");
}

export async function getFitbitSleep(api, date) {
  return api.get(`/api/fitbit/sleep/${date}`);
}

export async function getFitbitActivity(api, date) {
  return api.get(`/api/fitbit/activity/${date}`);
}

export async function getFitbitHeartRate(api, date) {
  return api.get(`/api/fitbit/heartrate/${date}`);
}

export async function disconnectFitbit(api) {
  return api.delete("/api/fitbit/disconnect");
}

export async function getWeeklySummary(api, weekOf) {
  return api.get(`/api/fitbit/weekly-summary?weekOf=${weekOf}`);
}

export async function getWeeklyInsight(api, weekOf) {
  return api.post("/api/coach/weekly-insight", { weekOf });
}
