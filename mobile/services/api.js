const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function createApiClient(accessToken) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  return {
    get: async (path) => {
      const response = await fetch(`${API_URL}${path}`, { headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }
      return response.json();
    },
    post: async (path, body) => {
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }
      return response.json();
    },
    put: async (path, body) => {
      const response = await fetch(`${API_URL}${path}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }
      return response.json();
    },
    delete: async (path) => {
      const response = await fetch(`${API_URL}${path}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }
      return response.json();
    },
  };
}
