import type {
  LogEntry,
  LogEntryCreate,
  Project,
  TimeSpanStartRequest,
  TimeSpan,
} from "./types";

/**
 * API client for Open Worklog backend.
 * 
 * All timestamps are handled as UTC. The backend serializes datetime objects
 * as ISO 8601 strings with 'Z' suffix (UTC indicator). The frontend should
 * ensure all timestamps sent to the backend include timezone info.
 */
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

// Running (open) TimeSpan lifecycle API
export function startTimeSpan(payload: TimeSpanStartRequest): Promise<TimeSpan> {
  return request<TimeSpan>(`${API_BASE}/timespans/start`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getActiveTimeSpan(): Promise<TimeSpan | null> {
  return request<TimeSpan | null>(`${API_BASE}/timespans/active`);
}

export function pauseTimeSpan(timespanId: number): Promise<TimeSpan> {
  return request<TimeSpan>(`${API_BASE}/timespans/${timespanId}/pause`, {
    method: "POST",
  });
}

// TimeSpan API functions
export function getTimeSpans(logId: number): Promise<TimeSpan[]> {
  return request<TimeSpan[]>(`${API_BASE}/logs/${logId}/timespans`);
}

export function createTimeSpan(
  logId: number,
  startTimestamp: string,
  endTimestamp: string
): Promise<TimeSpan> {
  return request<TimeSpan>(`${API_BASE}/logs/${logId}/timespans`, {
    method: "POST",
    body: JSON.stringify({
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
    }),
  });
}

export function deleteTimeSpan(timespanId: number): Promise<void> {
  return request<void>(`${API_BASE}/timespans/${timespanId}`, {
    method: "DELETE",
  });
}

export function adjustTimeSpan(
  timespanId: number,
  hours: number
): Promise<TimeSpan> {
  return request<TimeSpan>(`${API_BASE}/timespans/${timespanId}/adjust`, {
    method: "POST",
    body: JSON.stringify({ hours }),
  });
}

/**
 * Update a TimeSpan's timestamps.
 * 
 * Timestamps should be ISO 8601 strings with UTC timezone indicator ('Z' suffix).
 * The backend expects and returns all timestamps in UTC format.
 * 
 * @param timespanId - The ID of the TimeSpan to update
 * @param startTimestamp - ISO 8601 UTC timestamp string (e.g., "2024-01-01T12:00:00Z")
 * @param endTimestamp - Optional ISO 8601 UTC timestamp string
 */
export function updateTimeSpan(
  timespanId: number,
  startTimestamp: string,
  endTimestamp?: string
): Promise<TimeSpan> {
  return request<TimeSpan>(`${API_BASE}/timespans/${timespanId}`, {
    method: "PUT",
    body: JSON.stringify({
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
    }),
  });
}

// Project API functions
export function fetchProjects(search?: string): Promise<Project[]> {
  const url = search
    ? `${API_BASE}/projects?search=${encodeURIComponent(search)}`
    : `${API_BASE}/projects`;
  return request<Project[]>(url);
}

export function createProject(
  name: string,
  description?: string
): Promise<Project> {
  return request<Project>(`${API_BASE}/projects`, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export function getProject(id: number): Promise<Project> {
  return request<Project>(`${API_BASE}/projects/${id}`);
}
