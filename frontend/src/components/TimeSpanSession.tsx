import React, { useState, useRef, useEffect } from "react";
import type { TimeSpan } from "../types";

interface TimeSpanSessionProps {
  timespan: TimeSpan;
  index: number;
  onUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
  onAdjust?: (timespanId: number, hours: number) => void;
}

const MIN_DURATION_HOURS = 0.25;
const HOURS_PER_DAY = 24;
const MINUTES_PER_QUARTER = 15;

export default function TimeSpanSession({
  timespan,
  index,
  onUpdate,
  onAdjust,
}: TimeSpanSessionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [dragState, setDragState] = useState<null | "start" | "end">(null);
  const [previewStart, setPreviewStart] = useState<Date | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Date | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const startTime = new Date(timespan.start_timestamp);
  const endTime = timespan.end_timestamp ? new Date(timespan.end_timestamp) : new Date();

  // Calculate hours from midnight for positioning
  const getHoursFromMidnight = (date: Date): number => {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  };

  // Round to nearest 0.25 hour increment
  const roundToQuarterHour = (hours: number): number => {
    return Math.round(hours * 4) / 4;
  };

  // Convert hours from midnight to pixel position
  const hoursToPosition = (hours: number, containerWidth: number): number => {
    return (hours / HOURS_PER_DAY) * containerWidth;
  };

  // Convert pixel position to hours from midnight
  const positionToHours = (pixels: number, containerWidth: number): number => {
    return (pixels / containerWidth) * HOURS_PER_DAY;
  };

  // Get current display times (use preview if dragging)
  const displayStart = previewStart || startTime;
  const displayEnd = previewEnd || endTime;

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (start: string, end?: string): string => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
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
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle drag start
  const handleDragStart = (handle: "start" | "end", e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditing) return;
    setDragState(handle);
  };

  // Handle drag
  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!dragState || !timelineRef.current) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const containerWidth = rect.width;

    let newHours = positionToHours(x, containerWidth);
    newHours = Math.max(0, Math.min(HOURS_PER_DAY, newHours));
    newHours = roundToQuarterHour(newHours);

    // Create new date with the calculated hours, preserving the original date
    const baseDate = new Date(startTime);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();
    const newDate = new Date(year, month, day, Math.floor(newHours), (newHours % 1) * 60, 0, 0);

    if (dragState === "start") {
      // Ensure start is before end and minimum duration
      const endHours = getHoursFromMidnight(displayEnd);
      if (newHours >= endHours - MIN_DURATION_HOURS) {
        newHours = Math.max(0, endHours - MIN_DURATION_HOURS);
        newHours = roundToQuarterHour(newHours);
        const adjustedDate = new Date(year, month, day, Math.floor(newHours), (newHours % 1) * 60, 0, 0);
        setPreviewStart(adjustedDate);
      } else {
        setPreviewStart(newDate);
      }
    } else {
      // Ensure end is after start and minimum duration
      const startHours = getHoursFromMidnight(displayStart);
      if (newHours <= startHours + MIN_DURATION_HOURS) {
        newHours = Math.min(HOURS_PER_DAY, startHours + MIN_DURATION_HOURS);
        newHours = roundToQuarterHour(newHours);
        const adjustedDate = new Date(year, month, day, Math.floor(newHours), (newHours % 1) * 60, 0, 0);
        setPreviewEnd(adjustedDate);
      } else {
        setPreviewEnd(newDate);
      }
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    if (!dragState) return;

    const finalStart = previewStart || startTime;
    const finalEnd = previewEnd || endTime;

    // Ensure valid times
    if (finalStart >= finalEnd) {
      // Reset preview
      setPreviewStart(null);
      setPreviewEnd(null);
      setDragState(null);
      return;
    }

    // Call update callback
    if (onUpdate) {
      onUpdate(
        timespan.id,
        finalStart.toISOString(),
        timespan.end_timestamp ? finalEnd.toISOString() : undefined
      );
    }

    // Reset drag state
    setPreviewStart(null);
    setPreviewEnd(null);
    setDragState(null);
  };

  // Store handleDrag and handleDragEnd in refs to avoid dependency issues
  const handleDragRef = useRef(handleDrag);
  const handleDragEndRef = useRef(handleDragEnd);
  
  useEffect(() => {
    handleDragRef.current = handleDrag;
    handleDragEndRef.current = handleDragEnd;
  });

  // Set up global drag listeners
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => handleDragRef.current(e);
    const handleTouchMove = (e: TouchEvent) => handleDragRef.current(e);
    const handleMouseUp = () => handleDragEndRef.current();
    const handleTouchEnd = () => handleDragEndRef.current();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dragState]);

  // Calculate timeline positions
  const containerWidth = timelineRef.current?.clientWidth || 600;
  const startHours = getHoursFromMidnight(displayStart);
  const endHours = getHoursFromMidnight(displayEnd);
  const barLeft = hoursToPosition(startHours, containerWidth);
  const barWidth = hoursToPosition(endHours - startHours, containerWidth);

  const isRunning = !timespan.end_timestamp;

  return (
    <div className="timespan-session">
      <div className="timespan-session-header">
        <div className="timespan-session-info">
          <span className="timespan-session-index">#{index + 1}</span>
          <div className="timespan-session-details">
            <div className="timespan-session-time">
              {formatDateTime(timespan.start_timestamp)}
              {timespan.end_timestamp ? (
                <> → {formatDateTime(timespan.end_timestamp)}</>
              ) : (
                " → (running)"
              )}
            </div>
            <div className="timespan-session-duration">
              {formatDuration(timespan.start_timestamp, timespan.end_timestamp)}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="timespan-session-edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(!isEditing);
            if (isEditing) {
              // Cancel any preview when exiting edit mode
              setPreviewStart(null);
              setPreviewEnd(null);
              setDragState(null);
            }
          }}
        >
          {isEditing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="timespan-session-timeline-container" ref={timelineRef}>
        <div className="timespan-session-timeline">
          {/* Hour markers */}
          {Array.from({ length: HOURS_PER_DAY + 1 }, (_, i) => (
            <div
              key={i}
              className="timespan-session-hour-marker"
              style={{ left: `${(i / HOURS_PER_DAY) * 100}%` }}
            >
              {i % 4 === 0 && (
                <span className="timespan-session-hour-label">
                  {String(i).padStart(2, "0")}:00
                </span>
              )}
            </div>
          ))}

          {/* Session bar */}
          <div
            className={`timespan-session-bar ${isEditing ? "editing" : ""} ${isRunning ? "running" : ""}`}
            style={{
              left: `${(barLeft / containerWidth) * 100}%`,
              width: `${(barWidth / containerWidth) * 100}%`,
            }}
          >
            {isEditing && (
              <>
                {/* Start handle */}
                <div
                  className="timespan-session-handle timespan-session-handle-start"
                  onMouseDown={(e) => handleDragStart("start", e)}
                  onTouchStart={(e) => handleDragStart("start", e)}
                >
                  <div className="timespan-session-handle-dot" />
                </div>
                {/* End handle */}
                <div
                  className="timespan-session-handle timespan-session-handle-end"
                  onMouseDown={(e) => handleDragStart("end", e)}
                  onTouchStart={(e) => handleDragStart("end", e)}
                >
                  <div className="timespan-session-handle-dot" />
                </div>
              </>
            )}
            {isEditing && (
              <div className="timespan-session-bar-label">
                {formatTime(displayStart)} - {formatTime(displayEnd)}
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditing && onAdjust && timespan.end_timestamp && (
        <div className="timespan-session-adjust">
          <div className="timespan-session-adjust-buttons">
            {[0.25, 0.5, 1].map((hours) => (
              <React.Fragment key={hours}>
                <button
                  type="button"
                  className="timespan-session-adjust-btn add"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdjust(timespan.id, hours);
                  }}
                  title={`Add ${hours}h`}
                >
                  +{hours}h
                </button>
                {((endHours - startHours) > hours) && (
                  <button
                    type="button"
                    className="timespan-session-adjust-btn subtract"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdjust(timespan.id, -hours);
                    }}
                    title={`Subtract ${hours}h`}
                  >
                    -{hours}h
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
