export async function getCoachInsight(api, date, context) {
  return api.post("/api/coach/insight", { date, context });
}
