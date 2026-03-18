export async function getProfile(api) {
  return api.get("/api/profile");
}

export async function createProfile(api, profileData) {
  return api.post("/api/profile", profileData);
}

export async function updateProfile(api, profileData) {
  return api.put("/api/profile", profileData);
}
