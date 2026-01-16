const API_BASE = "/api/v1";

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export function fetchLogsByDate(date) {
  return request(`${API_BASE}/logs/${date}`);
}

export function createLog(payload) {
  return request(`${API_BASE}/logs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLog(id, payload) {
  return request(`${API_BASE}/logs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteLog(id) {
  return request(`${API_BASE}/logs/${id}`, {
    method: "DELETE",
  });
}
