import React from "react";
import type { Timer } from "../types";
import { useTimer } from "../hooks/useTimer";
import type { TimeSpan } from "../types";

interface TimerControlsProps {
  timer: Timer | null;
  entryId: number;
  timespans?: TimeSpan[];
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function TimerControls({
  timer,
  entryId,
  timespans = [],
  disabled = false,
  onStart,
  onPause,
  onResume,
  onStop,
}: TimerControlsProps) {
  const isActiveForThisEntry = timer?.log_entry_id === entryId;
  const { formattedTime, isRunning, isPaused } = useTimer(
    isActiveForThisEntry ? timer : null,
    timespans
  );

  const hasActiveTimer = timer !== null;
  const canStart = !hasActiveTimer || isActiveForThisEntry;
  const canPause = isActiveForThisEntry && isRunning;
  const canResume = isActiveForThisEntry && isPaused;
  const canStop = isActiveForThisEntry && (isRunning || isPaused);

  return (
    <div className="timer-controls">
      <div className="timer-display">
        {isActiveForThisEntry && (
          <>
            <span className={`timer-indicator ${isRunning ? "running" : "paused"}`}>
              {isRunning ? "●" : "○"}
            </span>
            <span className="timer-time">{formattedTime}</span>
          </>
        )}
      </div>
      <div className="timer-buttons">
        {!isActiveForThisEntry && (
          <button
            className="timer-button start"
            onClick={onStart}
            disabled={disabled || !canStart}
          >
            Start
          </button>
        )}
        {canPause && (
          <button className="timer-button pause" onClick={onPause}>
            Pause
          </button>
        )}
        {canResume && (
          <button className="timer-button resume" onClick={onResume}>
            Resume
          </button>
        )}
        {canStop && (
          <button className="timer-button stop" onClick={onStop}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
