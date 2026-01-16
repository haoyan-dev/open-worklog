import { useEffect, useState, useRef } from "react";
import type { Timer, TimeSpan } from "../types";
import { getTimeSpans } from "../api";

interface UseTimerResult {
  elapsedHours: number;
  elapsedSeconds: number;
  formattedTime: string;
  isRunning: boolean;
  isPaused: boolean;
  accumulatedHours: number;
}

export function useTimer(
  timer: Timer | null | undefined,
  timespans: TimeSpan[] = []
): UseTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) {
      setElapsedSeconds(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const calculateElapsed = () => {
      if (timer.status === "running") {
        const startTime = new Date(timer.started_at).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(elapsed);
      } else {
        // For paused timer, don't update elapsed time
        setElapsedSeconds(0);
      }
    };

    // Calculate initial elapsed time
    calculateElapsed();

    // Update every second if running
    if (timer.status === "running") {
      intervalRef.current = window.setInterval(calculateElapsed, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timer]);

  // Calculate accumulated hours from completed TimeSpans
  const accumulatedHours = timespans.reduce((total, span) => {
    if (span.end_timestamp) {
      const start = new Date(span.start_timestamp).getTime();
      const end = new Date(span.end_timestamp).getTime();
      const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
      return total + duration;
    }
    return total;
  }, 0);

  // Current session hours (if timer is running)
  const currentSessionHours =
    timer && timer.status === "running"
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
    isRunning: timer?.status === "running",
    isPaused: timer?.status === "paused",
    accumulatedHours,
  };
}
