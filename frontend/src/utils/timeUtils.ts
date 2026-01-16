/**
 * Utility functions for time and date calculations
 * 
 * All timestamps are handled as UTC. The backend sends ISO 8601 strings with 'Z' suffix (UTC),
 * and the frontend should treat all timestamps as UTC to avoid timezone shifts.
 */

/**
 * Calculate hours from midnight for positioning
 */
export function getHoursFromMidnight(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Round to nearest 0.25 hour increment
 */
export function roundToQuarterHour(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/**
 * Convert hours from midnight to Date object
 */
export function hoursToDate(hours: number, baseDate: Date): Date {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  const hour = Math.floor(hours);
  const minute = Math.floor((hours % 1) * 60);
  const second = Math.floor(((hours % 1) * 60 - minute) * 60);
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Parse UTC timestamp string to Date object.
 * If the string doesn't have timezone info, assumes UTC.
 * All timestamps from the backend are in UTC.
 */
export function parseUTCDate(isoString: string): Date {
  // If no timezone info (no Z, +, or - after the date part), assume UTC
  // Check for timezone indicators: Z, +HH:MM, or -HH:MM
  const hasTimezone = isoString.includes('Z') || 
                      /[+-]\d{2}:\d{2}$/.test(isoString) ||
                      /[+-]\d{4}$/.test(isoString);
  
  if (!hasTimezone && isoString.length >= 10) {
    // No timezone info, append 'Z' to treat as UTC
    return new Date(isoString + 'Z');
  }
  
  return new Date(isoString);
}

/**
 * Format datetime for display
 * Parses the ISO string (treated as UTC) and displays it in local time
 */
export function formatDateTime(isoString: string): string {
  // Parse the ISO string as UTC
  const date = parseUTCDate(isoString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.warn("Invalid date string:", isoString);
    return "Invalid date";
  }
  
  // Use toLocaleString with explicit options to ensure consistent formatting
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format duration between two timestamps
 * Both timestamps are treated as UTC.
 */
export function formatDuration(start: string, end?: string): string {
  const startTime = parseUTCDate(start).getTime();
  const endTime = end ? parseUTCDate(end).getTime() : Date.now();
  const hours = (endTime - startTime) / (1000 * 60 * 60);

  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes}m`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.floor((hours - wholeHours) * 60);
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

/**
 * Format time only (HH:MM)
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format time in 24-hour format (HH:MM)
 */
export function formatTime24(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format date in medium format (e.g., "Jan 15, 2024")
 */
export function formatDateMedium(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format datetime for grid labels (compact format)
 */
export function formatDateTimeLabel(date: Date, showDate: boolean = false): string {
  if (showDate) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate hours from TimeSpans, rounded to 0.25 increments
 * All timestamps are treated as UTC.
 */
export function calculateHoursFromTimeSpans(timespans: Array<{ start_timestamp: string; end_timestamp?: string }>): number {
  if (timespans.length === 0) return 0;
  
  const totalHours = timespans.reduce((total, span) => {
    const start = parseUTCDate(span.start_timestamp).getTime();
    const end = span.end_timestamp
      ? parseUTCDate(span.end_timestamp).getTime()
      : Date.now();
    const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
    return total + duration;
  }, 0);
  
  // Round to nearest 0.25 hour increment
  return roundToQuarterHour(totalHours);
}
