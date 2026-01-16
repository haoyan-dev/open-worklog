import type {
  LogEntry,
  LogEntryCreate,
  Project,
  Timer,
  TimerStartRequest,
  TimeSpan,
} from "./types";

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

// Timer API functions
export function startTimer(
  payload: TimerStartRequest
): Promise<Timer> {
  return request<Timer>(`${API_BASE}/timers/start`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getActiveTimer(): Promise<Timer | null> {
  return request<Timer | null>(`${API_BASE}/timers/active`);
}

export function pauseTimer(timerId: number): Promise<Timer> {
  return request<Timer>(`${API_BASE}/timers/${timerId}/pause`, {
    method: "POST",
  });
}

export function resumeTimer(timerId: number): Promise<Timer> {
  return request<Timer>(`${API_BASE}/timers/${timerId}/resume`, {
    method: "POST",
  });
}

export function stopTimer(timerId: number): Promise<LogEntry> {
  return request<LogEntry>(`${API_BASE}/timers/${timerId}/stop`, {
    method: "POST",
  });
}

export function cancelTimer(timerId: number): Promise<void> {
  return request<void>(`${API_BASE}/timers/${timerId}`, {
    method: "DELETE",
  });
}

// TimeSpan API functions
export function getTimeSpans(logId: number): Promise<TimeSpan[]> {
  return request<TimeSpan[]>(`${API_BASE}/logs/${logId}/timespans`);
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
