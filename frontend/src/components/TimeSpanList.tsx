import { useState } from "react";
import type { TimeSpan } from "../types";
import { parseUTCDate } from "../utils/timeUtils";
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
  console.log("[TimeSpanList] render", {
    timespansCount: timespans.length,
    hasOnUpdate: !!onUpdate,
    hasOnAdjust: !!onAdjust,
  });
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  if (timespans.length === 0) {
    return null;
  }

  // Parse timestamps as UTC to avoid timezone shifts
  const totalHours = timespans.reduce((total, span) => {
    const start = parseUTCDate(span.start_timestamp).getTime();
    const end = span.end_timestamp
      ? parseUTCDate(span.end_timestamp).getTime()
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
              key={`${span.id}-${span.start_timestamp}-${span.end_timestamp || 'running'}`}
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
