import React, { useState } from "react";
import type { TimeSpan } from "../types";

interface TimeSpanListProps {
  timespans: TimeSpan[];
  collapsed?: boolean;
  onAdjust?: (timespanId: number, hours: number) => void;
}

const ADJUST_BUTTONS = [0.25, 0.5, 1];

export default function TimeSpanList({
  timespans,
  collapsed: initiallyCollapsed = true,
  onAdjust,
}: TimeSpanListProps) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  if (timespans.length === 0) {
    return null;
  }

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

  const totalHours = timespans.reduce((total, span) => {
    const start = new Date(span.start_timestamp).getTime();
    const end = span.end_timestamp
      ? new Date(span.end_timestamp).getTime()
      : Date.now();
    return total + (end - start) / (1000 * 60 * 60);
  }, 0);

  return (
    <div className="timespan-list">
      <div
        className="timespan-list-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>
          {timespans.length} session{timespans.length !== 1 ? "s" : ""},{" "}
          {totalHours.toFixed(2)}h total
        </span>
        <span className="timespan-toggle">{collapsed ? "▼" : "▲"}</span>
      </div>
      {!collapsed && (
        <div className="timespan-list-items">
          {timespans.map((span, index) => {
            const duration = (() => {
              const start = new Date(span.start_timestamp).getTime();
              const end = span.end_timestamp
                ? new Date(span.end_timestamp).getTime()
                : Date.now();
              return (end - start) / (1000 * 60 * 60);
            })();
            
            return (
              <div key={span.id} className="timespan-item">
                <div className="timespan-index">#{index + 1}</div>
                <div className="timespan-details">
                  <div className="timespan-time">
                    {formatDateTime(span.start_timestamp)}
                    {span.end_timestamp ? (
                      <>
                        {" → "}
                        {formatDateTime(span.end_timestamp)}
                      </>
                    ) : (
                      " → (running)"
                    )}
                  </div>
                  <div className="timespan-duration">
                    {formatDuration(span.start_timestamp, span.end_timestamp)}
                  </div>
                </div>
                {onAdjust && span.end_timestamp && (
                  <div className="timespan-adjust">
                    <div className="timespan-adjust-buttons">
                      {ADJUST_BUTTONS.map((hours) => (
                        <React.Fragment key={hours}>
                          <button
                            type="button"
                            className="timespan-adjust-btn add"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdjust(span.id, hours);
                            }}
                            title={`Add ${hours}h`}
                          >
                            +{hours}h
                          </button>
                          {duration > hours && (
                            <button
                              type="button"
                              className="timespan-adjust-btn subtract"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAdjust(span.id, -hours);
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
          })}
        </div>
      )}
    </div>
  );
}
