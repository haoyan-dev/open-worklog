import { useEffect, useRef } from "react";
import { formatDateTime, formatDuration } from "../utils/timeUtils";
import type { TimeSpan } from "../types";

interface TimeSpanSessionHeaderProps {
  timespan: TimeSpan;
  index: number;
  isEditing: boolean;
  onToggleEdit: () => void;
}

export default function TimeSpanSessionHeader({
  timespan,
  index,
  isEditing,
  onToggleEdit,
}: TimeSpanSessionHeaderProps) {
  const prevTimespanRef = useRef<TimeSpan | null>(null);
  
  useEffect(() => {
    if (prevTimespanRef.current) {
      const prev = prevTimespanRef.current;
      const changed = 
        prev.id !== timespan.id ||
        prev.start_timestamp !== timespan.start_timestamp ||
        prev.end_timestamp !== timespan.end_timestamp;
      
      if (changed) {
        console.log("[TimeSpanSessionHeader] timespan prop changed", {
          timespanId: timespan.id,
          prev: {
            start_timestamp: prev.start_timestamp,
            end_timestamp: prev.end_timestamp,
          },
          current: {
            start_timestamp: timespan.start_timestamp,
            end_timestamp: timespan.end_timestamp,
          },
          // Log parsed dates for debugging
          prevParsed: {
            start: prev.start_timestamp ? new Date(prev.start_timestamp).toISOString() : null,
            end: prev.end_timestamp ? new Date(prev.end_timestamp).toISOString() : null,
          },
          currentParsed: {
            start: timespan.start_timestamp ? new Date(timespan.start_timestamp).toISOString() : null,
            end: timespan.end_timestamp ? new Date(timespan.end_timestamp).toISOString() : null,
          },
        });
      } else {
        console.log("[TimeSpanSessionHeader] timespan prop unchanged", {
          timespanId: timespan.id,
        });
      }
    } else {
      console.log("[TimeSpanSessionHeader] initial render", {
        timespanId: timespan.id,
        start_timestamp: timespan.start_timestamp,
        end_timestamp: timespan.end_timestamp,
      });
    }
    prevTimespanRef.current = timespan;
  }, [timespan]);
  
  return (
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
          onToggleEdit();
        }}
      >
        {isEditing ? "Done" : "Edit"}
      </button>
    </div>
  );
}
