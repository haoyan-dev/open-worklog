import React, { useState } from "react";
import type { TimeSpan } from "../types";
import TimeSpanSession from "./TimeSpanSession";

interface TimeSpanListProps {
  timespans: TimeSpan[];
  collapsed?: boolean;
  onAdjust?: (timespanId: number, hours: number) => void;
  onUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
}

export default function TimeSpanList({
  timespans,
  collapsed: initiallyCollapsed = true,
  onAdjust,
  onUpdate,
}: TimeSpanListProps) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  if (timespans.length === 0) {
    return null;
  }

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
          {timespans.map((span, index) => (
            <TimeSpanSession
              key={span.id}
              timespan={span}
              index={index}
              onUpdate={onUpdate}
              onAdjust={onAdjust}
            />
          ))}
        </div>
      )}
    </div>
  );
}
