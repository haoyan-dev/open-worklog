import { useEffect, useState, useRef } from "react";
import type { TimeSpan } from "../types";
import { parseUTCDate } from "../utils/timeUtils";

interface UseTimerResult {
  elapsedHours: number;
  elapsedSeconds: number;
  formattedTime: string;
  isRunning: boolean;
  accumulatedHours: number;
}

export function useTimer(
  activeTimeSpan: TimeSpan | null | undefined,
  timespans: TimeSpan[] = []
): UseTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const isRunning = Boolean(activeTimeSpan && !activeTimeSpan.end_timestamp);
    if (!activeTimeSpan || !isRunning) {
      setElapsedSeconds(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const calculateElapsed = () => {
      // Parse timestamp as UTC to avoid timezone shifts
      const startTime = parseUTCDate(activeTimeSpan.start_timestamp).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    // Calculate initial elapsed time
    calculateElapsed();

    intervalRef.current = window.setInterval(calculateElapsed, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTimeSpan?.id, activeTimeSpan?.start_timestamp, activeTimeSpan?.end_timestamp]);

  // Calculate accumulated hours from completed TimeSpans
  // Parse timestamps as UTC to avoid timezone shifts
  const accumulatedHours = timespans.reduce((total, span) => {
    if (span.end_timestamp) {
      const start = parseUTCDate(span.start_timestamp).getTime();
      const end = parseUTCDate(span.end_timestamp).getTime();
      const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
      return total + duration;
    }
    return total;
  }, 0);

  // Current session hours (if timer is running)
  const currentSessionHours =
    activeTimeSpan && !activeTimeSpan.end_timestamp
      ? elapsedSeconds / 3600
      : 0;

  // Total elapsed hours = accumulated + current session
  const elapsedHours = accumulatedHours + currentSessionHours;

  // Format time as "X.XXh" or "Xh XXm"
  const formatTime = (hours: number): string => {
    if (hours < 1) {
      return `${hours.toFixed(2)}h`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    return `${wholeHours}h ${minutes}m`;
  };

  return {
    elapsedHours,
    elapsedSeconds,
    formattedTime: formatTime(elapsedHours),
    isRunning: Boolean(activeTimeSpan && !activeTimeSpan.end_timestamp),
    accumulatedHours,
  };
}
