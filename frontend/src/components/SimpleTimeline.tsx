import React, { useState, useRef, useEffect, useCallback } from "react";
import { formatDateTimeLabel } from "../utils/timeUtils";

interface SimpleTimelineProps {
  startTime: Date;
  endTime: Date;
  isRunning?: boolean;
  isEditing?: boolean;
  onTimeChange?: (startTimestamp: string, endTimestamp: string) => void;
  height?: number;
}

type DragState = null | "move" | "resize-start" | "resize-end";

// Convert timestamp to pixel position
function timeToPixel(timestamp: number, timeFrom: number, timeTo: number, width: number): number {
  const ratio = (timestamp - timeFrom) / (timeTo - timeFrom);
  return ratio * width;
}

// Convert pixel position to timestamp
function pixelToTime(pixel: number, timeFrom: number, timeTo: number, width: number): number {
  const ratio = Math.max(0, Math.min(1, pixel / width));
  return timeFrom + ratio * (timeTo - timeFrom);
}

// Round to 15-minute increment
function snapToQuarterHour(timestamp: number): number {
  const date = new Date(timestamp);
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  date.setMinutes(roundedMinutes, 0, 0);
  return date.getTime();
}

// Generate time axis labels based on visible range
function generateTimeLabels(timeFrom: number, timeTo: number, width: number): Array<{ time: number; x: number; label: string }> {
  const range = timeTo - timeFrom;
  const rangeHours = range / (1000 * 60 * 60);
  
  let intervalMs: number;
  if (rangeHours < 2) {
    intervalMs = 15 * 60 * 1000; // 15 minutes
  } else if (rangeHours < 12) {
    intervalMs = 60 * 60 * 1000; // 1 hour
  } else {
    intervalMs = 3 * 60 * 60 * 1000; // 3 hours
  }
  
  const labels: Array<{ time: number; x: number; label: string }> = [];
  const startTime = Math.ceil(timeFrom / intervalMs) * intervalMs;
  
  for (let time = startTime; time <= timeTo; time += intervalMs) {
    const x = timeToPixel(time, timeFrom, timeTo, width);
    labels.push({
      time,
      x,
      label: formatDateTimeLabel(new Date(time)),
    });
  }
  
  return labels;
}

export default function SimpleTimeline({
  startTime,
  endTime,
  isRunning = false,
  isEditing = false,
  onTimeChange,
  height = 80,
}: SimpleTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentEndTime, setCurrentEndTime] = useState<Date>(endTime);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dragStart, setDragStart] = useState<{ 
    x: number; 
    startTime: number; 
    endTime: number;
    timeFrom: number;
    timeTo: number;
  } | null>(null);
  const [localStartTime, setLocalStartTime] = useState<Date>(startTime);
  const [localEndTime, setLocalEndTime] = useState<Date>(endTime);
  const [containerWidth, setContainerWidth] = useState(0);
  const currentDragTimesRef = useRef<{ startTime: number; endTime: number } | null>(null);
  const onTimeChangeRef = useRef(onTimeChange);
  const lastSentUpdateRef = useRef<{ startTime: number; endTime: number } | null>(null);
  const isUpdatingRef = useRef(false);

  // Keep onTimeChange ref up to date
  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);

  // Update local times when props change (but not during drag or immediately after sending update)
  // Only sync if we're not currently updating or if props match what we sent
  useEffect(() => {
    if (dragState === null && !isUpdatingRef.current) {
      const startMs = startTime.getTime();
      const endMs = endTime.getTime();
      const localStartMs = localStartTime.getTime();
      const localEndMs = localEndTime.getTime();
      
      // Check if props match what we last sent (update completed)
      if (lastSentUpdateRef.current) {
        const sent = lastSentUpdateRef.current;
        // Use 1-minute tolerance to account for rounding differences and timezone issues
        const startMatches = Math.abs(startMs - sent.startTime) < 60000;
        const endMatches = Math.abs(endMs - sent.endTime) < 60000;
        
        if (startMatches && endMatches) {
          // Props match our update - clear the tracking and sync
          lastSentUpdateRef.current = null;
          setLocalStartTime(startTime);
          setLocalEndTime(endTime);
          return;
        }
        // Props don't match yet (might be stale data from before update) - keep local state
        // Don't reset to avoid flickering back to old values
        return;
      }
      
      // No pending update - check if props differ significantly from local state
      const startDiff = Math.abs(startMs - localStartMs);
      const endDiff = Math.abs(endMs - localEndMs);
      // Only sync if props changed significantly (more than 1 minute) - likely update from elsewhere
      if (startDiff > 60000 || endDiff > 60000) {
        setLocalStartTime(startTime);
        setLocalEndTime(endTime);
      }
    }
  }, [startTime, endTime, dragState]);

  // Update current end time for running spans
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setCurrentEndTime(new Date());
        if (dragState === null) {
          setLocalEndTime(new Date());
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCurrentEndTime(endTime);
    }
  }, [isRunning, endTime, dragState]);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Calculate visible time range with 20% padding
  // During drag, use fixed range from dragStart to keep axis stable
  // Otherwise, calculate from current times
  const startMs = localStartTime.getTime();
  const endMs = (isRunning ? currentEndTime : localEndTime).getTime();
  
  let timeFrom: number;
  let timeTo: number;
  
  if (dragState !== null && dragStart) {
    // During drag, keep the axis fixed using the range from when drag started
    timeFrom = dragStart.timeFrom;
    timeTo = dragStart.timeTo;
  } else {
    // When not dragging, calculate range from current times
    const duration = endMs - startMs;
    const padding = duration * 0.2;
    timeFrom = Math.max(0, startMs - padding);
    timeTo = endMs + padding;
  }

  const width = containerWidth;
  const axisHeight = 20;
  const barHeight = 30;
  const barY = axisHeight + 10;

  // Convert times to pixel positions
  const barStartX = timeToPixel(startMs, timeFrom, timeTo, width);
  const barEndX = timeToPixel(endMs, timeFrom, timeTo, width);
  const barWidth = barEndX - barStartX;

  // Generate time labels
  const timeLabels = generateTimeLabels(timeFrom, timeTo, width);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent, action: DragState) => {
    if (!isEditing || !svgRef.current) return;

    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const startTimeMs = localStartTime.getTime();
    const endTimeMs = localEndTime.getTime();
    
    // Calculate and store the visible range at drag start to keep axis fixed
    const duration = endTimeMs - startTimeMs;
    const padding = duration * 0.2;
    const timeFrom = Math.max(0, startTimeMs - padding);
    const timeTo = endTimeMs + padding;
    
    setDragState(action);
    setDragStart({
      x,
      startTime: startTimeMs,
      endTime: endTimeMs,
      timeFrom,
      timeTo,
    });
    // Initialize current drag times ref
    currentDragTimesRef.current = {
      startTime: startTimeMs,
      endTime: endTimeMs,
    };
  }, [isEditing, localStartTime, localEndTime]);

  // Handle mouse move
  useEffect(() => {
    if (dragState === null || !dragStart || !svgRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = svgRef.current!.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(width, e.clientX - rect.left)); // Clamp to valid range
      // Use fixed time range from dragStart to keep axis stable
      const fixedTimeFrom = dragStart.timeFrom;
      const fixedTimeTo = dragStart.timeTo;
      
      // Convert current mouse position directly to time
      const mouseTime = snapToQuarterHour(pixelToTime(currentX, fixedTimeFrom, fixedTimeTo, width));

      let newStartTime = dragStart.startTime;
      let newEndTime = dragStart.endTime;

      if (dragState === "move") {
        // Move the entire bar - use delta to maintain relative position
        const initialBarStartX = timeToPixel(dragStart.startTime, fixedTimeFrom, fixedTimeTo, width);
        const initialOffsetFromBarStart = dragStart.x - initialBarStartX;
        // New bar start is mouse position minus the initial offset
        const newBarStartX = currentX - initialOffsetFromBarStart;
        const newBarStartTime = snapToQuarterHour(pixelToTime(newBarStartX, fixedTimeFrom, fixedTimeTo, width));
        const duration = dragStart.endTime - dragStart.startTime;
        // Clamp to valid range
        newStartTime = Math.max(fixedTimeFrom, Math.min(newBarStartTime, fixedTimeTo - duration));
        newEndTime = snapToQuarterHour(newStartTime + duration);
      } else if (dragState === "resize-start") {
        // Resize from start - use mouse position directly
        newStartTime = Math.max(fixedTimeFrom, mouseTime);
        // Ensure start is before end (with minimum duration)
        const minEndTime = newStartTime + 15 * 60 * 1000; // Minimum 15 minutes
        if (newEndTime < minEndTime) {
          newStartTime = snapToQuarterHour(newEndTime - 15 * 60 * 1000);
        }
      } else if (dragState === "resize-end") {
        // Resize from end - use mouse position directly
        newEndTime = Math.min(fixedTimeTo, mouseTime);
        // Ensure end is after start (with minimum duration)
        const minStartTime = newEndTime - 15 * 60 * 1000; // Minimum 15 minutes
        if (newStartTime > minStartTime) {
          newEndTime = snapToQuarterHour(newStartTime + 15 * 60 * 1000);
        }
      }

      // Always update local times for display
      setLocalStartTime(new Date(newStartTime));
      setLocalEndTime(new Date(newEndTime));
      
      // Track current drag times for mouse up - always update this ref
      currentDragTimesRef.current = { startTime: newStartTime, endTime: newEndTime };
    };

    const handleMouseUp = () => {
      if (dragState !== null && onTimeChangeRef.current) {
        // Always use the ref value which is updated on every mouse move
        // The ref should always be set from handleMouseDown initialization
        const finalTimes = currentDragTimesRef.current;
        
        if (finalTimes) {
          // Mark that we're updating to prevent prop sync from resetting values
          isUpdatingRef.current = true;
          
          // Store what we're sending to track when update completes
          lastSentUpdateRef.current = {
            startTime: finalTimes.startTime,
            endTime: finalTimes.endTime,
          };
          
          // Call callback with the final dragged times
          onTimeChangeRef.current(
            new Date(finalTimes.startTime).toISOString(),
            new Date(finalTimes.endTime).toISOString()
          );
          
          // Allow prop sync after a short delay (gives time for API call to start)
          // The actual sync will happen when props match what we sent
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 100);
          
          // Clear tracking after a longer delay in case update fails
          // This prevents getting stuck if the update never completes
          setTimeout(() => {
            lastSentUpdateRef.current = null;
          }, 10000);
        }
      }
      
      setDragState(null);
      setDragStart(null);
      currentDragTimesRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, dragStart, timeFrom, timeTo, width, isRunning, localStartTime, localEndTime, endTime]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => handleMouseDown(e, "resize-start"), [handleMouseDown]);
  const handleResizeEnd = useCallback((e: React.MouseEvent) => handleMouseDown(e, "resize-end"), [handleMouseDown]);
  const handleMove = useCallback((e: React.MouseEvent) => handleMouseDown(e, "move"), [handleMouseDown]);

  return (
    <div ref={containerRef} className="simple-timeline-container" style={{ height: `${height}px`, width: "100%" }}>
      {width > 0 && (
        <svg ref={svgRef} width={width} height={height} className="simple-timeline-svg">
          {/* Grid lines - extend through full height including time span area */}
          {timeLabels.map((label, idx) => (
            <line
              key={`grid-${idx}`}
              x1={label.x}
              y1={0}
              x2={label.x}
              y2={height}
              stroke="#f0f2f7"
              strokeWidth={1}
              strokeDasharray="2,2"
              className="simple-timeline-grid-line"
            />
          ))}

          {/* Time axis line */}
          <line
            x1={0}
            y1={axisHeight}
            x2={width}
            y2={axisHeight}
            stroke="#eef0f5"
            strokeWidth={1}
          />

          {/* Time axis labels */}
          {timeLabels.map((label, idx) => (
            <g key={idx}>
              <line
                x1={label.x}
                y1={axisHeight - 4}
                x2={label.x}
                y2={axisHeight}
                stroke="#eef0f5"
                strokeWidth={1}
              />
              <text
                x={label.x}
                y={axisHeight - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#7d8496"
                className="simple-timeline-label"
              >
                {label.label}
              </text>
            </g>
          ))}

          {/* Time span bar */}
          <g className="simple-timeline-bar-group">
            <rect
              x={barStartX}
              y={barY}
              width={Math.max(2, barWidth)}
              height={barHeight}
              fill="#6c8cff"
              stroke={isEditing ? "#4a6fcf" : "#6c8cff"}
              strokeWidth={isEditing ? 2 : 1}
              rx={4}
              className="simple-timeline-bar"
              style={{ cursor: isEditing ? "move" : "default" }}
              onMouseDown={isEditing ? handleMove : undefined}
            />

            {/* Resize handles (only in edit mode) */}
            {isEditing && barWidth > 10 && (
              <>
                <rect
                  x={barStartX - 4}
                  y={barY}
                  width={8}
                  height={barHeight}
                  fill="#4a6fcf"
                  rx={2}
                  className="simple-timeline-handle"
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={handleResizeStart}
                />
                <rect
                  x={barEndX - 4}
                  y={barY}
                  width={8}
                  height={barHeight}
                  fill="#4a6fcf"
                  rx={2}
                  className="simple-timeline-handle"
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={handleResizeEnd}
                />
              </>
            )}
          </g>
        </svg>
      )}
    </div>
  );
}
