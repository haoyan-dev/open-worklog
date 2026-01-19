import type {
  LogEntry,
  LogEntryCreate,
  DailyStat,
  DailyReport,
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
const DEV_FALLBACK_BASE = import.meta.env.DEV
  ? "http://localhost:8000/api/v1"
  : "";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
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

async function requestWithFallback<T>(
  url: string,
  fallbackUrl: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    return await request<T>(url, options);
  } catch (error) {
    if (!DEV_FALLBACK_BASE || !fallbackUrl) {
      throw error;
    }
    const response = await fetch(fallbackUrl, {
      cache: "no-store",
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
}

function getFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/filename=\"?([^\";]+)\"?/i);
  return match ? match[1] : null;
}

async function downloadResponseAsFile(
  response: Response,
  fallbackName: string
): Promise<void> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  const blob = await response.blob();
  const headerName = getFilenameFromHeader(
    response.headers.get("Content-Disposition")
  );
  const filename = headerName || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function fetchLogsByDate(date: string): Promise<LogEntry[]> {
  return request<LogEntry[]>(`${API_BASE}/logs/${date}`);
}

export function fetchStats(startDate: string, endDate: string): Promise<DailyStat[]> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return request<DailyStat[]>(`${API_BASE}/stats?${params.toString()}`);
}

export function fetchDailyReport(date: string): Promise<DailyReport> {
  const params = new URLSearchParams({ date });
  const url = `${API_BASE}/reports/daily?${params.toString()}`;
  const fallbackUrl = DEV_FALLBACK_BASE
    ? `${DEV_FALLBACK_BASE}/reports/daily?${params.toString()}`
    : "";
  return requestWithFallback<DailyReport>(url, fallbackUrl);
}

export async function downloadDailyReport(date: string): Promise<void> {
  const params = new URLSearchParams({ date });
  const url = `${API_BASE}/reports/daily?${params.toString()}`;
  const fallbackUrl = DEV_FALLBACK_BASE
    ? `${DEV_FALLBACK_BASE}/reports/daily?${params.toString()}`
    : "";
  let response = await fetch(url, { cache: "no-store" });
  if (!response.ok && fallbackUrl) {
    response = await fetch(fallbackUrl, { cache: "no-store" });
  }
  await downloadResponseAsFile(response, `daily-report-${date}.json`);
}

export interface WeeklyReportOptions {
  weekStart: string;
  author?: string;
  summaryQualitative?: string;
  summaryQuantitative?: string;
  nextWeekPlan?: string[];
}

export async function downloadWeeklyReport(
  options: WeeklyReportOptions
): Promise<void> {
  const params = new URLSearchParams({ week_start: options.weekStart });
  if (options.author) params.set("author", options.author);
  if (options.summaryQualitative) {
    params.set("summary_qualitative", options.summaryQualitative);
  }
  if (options.summaryQuantitative) {
    params.set("summary_quantitative", options.summaryQuantitative);
  }
  if (options.nextWeekPlan && options.nextWeekPlan.length > 0) {
    options.nextWeekPlan.forEach((item) => params.append("next_week_plan", item));
  }
  const url = `${API_BASE}/reports/weekly?${params.toString()}`;
  const fallbackUrl = DEV_FALLBACK_BASE
    ? `${DEV_FALLBACK_BASE}/reports/weekly?${params.toString()}`
    : "";
  let response = await fetch(url, { cache: "no-store" });
  if (!response.ok && fallbackUrl) {
    response = await fetch(fallbackUrl, { cache: "no-store" });
  }
  await downloadResponseAsFile(
    response,
    `weekly-report-${options.weekStart}.json`
  );
}

export function fetchLogByUuid(uuid: string): Promise<LogEntry> {
  return request<LogEntry>(`${API_BASE}/logs/uuid/${encodeURIComponent(uuid)}`);
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
