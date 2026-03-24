export async function getTemplates(api) {
  return api.get("/api/workouts/templates");
}

export async function createTemplate(api, templateData) {
  return api.post("/api/workouts/templates", templateData);
}

export async function updateTemplate(api, id, templateData) {
  return api.put(`/api/workouts/templates/${id}`, templateData);
}

export async function deleteTemplate(api, id) {
  return api.delete(`/api/workouts/templates/${id}`);
}

export async function getWorkoutLogs(api, date) {
  return api.get(`/api/workouts/logs/${date}`);
}

export async function logWorkout(api, workoutData) {
  return api.post("/api/workouts/logs", workoutData);
}

export async function deleteWorkoutLog(api, id) {
  return api.delete(`/api/workouts/logs/${id}`);
}

export async function parseWorkoutText(api, text) {
  return api.post("/api/workouts/parse", { text });
}
