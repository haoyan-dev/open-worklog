import { useState, useEffect, useRef } from "react";
import type { TimeSpan } from "../types";
import { parseUTCDate } from "../utils/timeUtils";
import TimeSpanSessionHeader from "./TimeSpanSessionHeader";
import TimeSpanAdjustButtons from "./TimeSpanAdjustButtons";
import SimpleTimeline from "./SimpleTimeline";

interface TimeSpanSessionProps {
  timespan: TimeSpan;
  index: number;
  onUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
  onAdjust?: (timespanId: number, hours: number) => void;
}

export default function TimeSpanSession({
  timespan,
  index,
  onUpdate,
  onAdjust,
}: TimeSpanSessionProps) {
  console.log("[TimeSpanSession] render", {
    timespanId: timespan.id,
    index,
    hasOnUpdate: !!onUpdate,
    hasOnAdjust: !!onAdjust,
  });
  const prevTimespanRef = useRef<TimeSpan | null>(null);
  
  useEffect(() => {
    if (prevTimespanRef.current) {
      const prev = prevTimespanRef.current;
      const changed = 
        prev.id !== timespan.id ||
        prev.start_timestamp !== timespan.start_timestamp ||
        prev.end_timestamp !== timespan.end_timestamp;
      
      if (changed) {
        console.log("[TimeSpanSession] timespan prop changed", {
          timespanId: timespan.id,
          index,
          prev: {
            start_timestamp: prev.start_timestamp,
            end_timestamp: prev.end_timestamp,
          },
          current: {
            start_timestamp: timespan.start_timestamp,
            end_timestamp: timespan.end_timestamp,
          },
        });
      }
    } else {
      console.log("[TimeSpanSession] initial render", {
        timespanId: timespan.id,
        index,
      });
    }
    prevTimespanRef.current = timespan;
  }, [timespan, index]);
  const [isEditing, setIsEditing] = useState(false);

  // Parse timestamps as UTC to avoid timezone shifts
  const startTime = parseUTCDate(timespan.start_timestamp);
  const endTime = timespan.end_timestamp ? parseUTCDate(timespan.end_timestamp) : new Date();
  const isRunning = !timespan.end_timestamp;

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleTimeChange = (startTimestamp: string, endTimestamp: string) => {
    console.log("[TimeSpanSession] handleTimeChange called", {
      timespanId: timespan.id,
      startTimestamp,
      endTimestamp,
      currentStart: timespan.start_timestamp,
      currentEnd: timespan.end_timestamp,
    });
    if (onUpdate) {
      onUpdate(timespan.id, startTimestamp, endTimestamp);
    } else {
      console.log("[TimeSpanSession] handleTimeChange: onUpdate not provided");
    }
  };

  return (
    <div className="timespan-session">
      <TimeSpanSessionHeader
        timespan={timespan}
        index={index}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
      />

      <div className="timespan-session-gstc-container">
        <SimpleTimeline
          startTime={startTime}
          endTime={endTime}
          isRunning={isRunning}
          isEditing={isEditing}
          onTimeChange={handleTimeChange}
          height={80}
        />
      </div>

      {isEditing && onAdjust && timespan.end_timestamp && (
        <TimeSpanAdjustButtons
          timespanId={timespan.id}
          startTime={startTime}
          endTime={endTime}
          onAdjust={onAdjust}
        />
      )}
    </div>
  );
}
