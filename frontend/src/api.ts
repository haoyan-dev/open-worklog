import type { LogEntry, LogEntryCreate } from "./types";

const API_BASE = "/api/v1";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json() as Promise<T>;
}

export function fetchLogsByDate(date: string): Promise<LogEntry[]> {
  return request<LogEntry[]>(`${API_BASE}/logs/${date}`);
}

export function createLog(payload: LogEntryCreate): Promise<LogEntry> {
  return request<LogEntry>(`${API_BASE}/logs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLog(
  id: number,
  payload: LogEntryCreate
): Promise<LogEntry> {
  return request<LogEntry>(`${API_BASE}/logs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteLog(id: number): Promise<void> {
  return request<void>(`${API_BASE}/logs/${id}`, {
    method: "DELETE",
  });
}
