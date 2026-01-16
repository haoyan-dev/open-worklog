import React from "react";
import ReactMarkdown from "react-markdown";
import type { LogEntryCardProps } from "../types";
import TimerControls from "./TimerControls";
import TimeSpanList from "./TimeSpanList";

const CATEGORY_COLORS: Record<string, string> = {
  "Routine Work": "#6c8cff",
  OKR: "#ff8c5a",
  "Team Contribution": "#4fc37d",
  "Company Contribution": "#d18cff",
};

export default function LogEntryCard({
  entry,
  onEdit,
  onDelete,
  activeTimer,
  timespans = [],
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onStopTimer,
}: LogEntryCardProps) {
  return (
    <article className="log-card" onClick={() => onEdit(entry)}>
      <header className="log-card-header">
        <div>
          <div className="log-project">{entry.project_name || `Project #${entry.project_id}`}</div>
          <span
            className="log-category"
            style={{ background: CATEGORY_COLORS[entry.category] || "#999" }}
          >
            {entry.category}
          </span>
        </div>
        <div className="log-hours">{entry.hours.toFixed(1)}h</div>
      </header>
      <section className="log-card-body">
        <ReactMarkdown>{entry.task}</ReactMarkdown>
        {entry.notes ? (
          <div className="log-notes">
            <ReactMarkdown>{entry.notes}</ReactMarkdown>
          </div>
        ) : null}
        {timespans && timespans.length > 0 && (
          <TimeSpanList timespans={timespans} />
        )}
      </section>
      <footer className="log-card-footer">
        <div className="log-card-footer-left">
          <span>{entry.status || "Completed"}</span>
          {onStartTimer && (
            <TimerControls
              timer={activeTimer}
              entryId={entry.id}
              timespans={timespans}
              disabled={activeTimer !== null && activeTimer.log_entry_id !== entry.id}
              onStart={() => {
                if (onStartTimer) onStartTimer(entry.id);
              }}
              onPause={() => {
                if (activeTimer && onPauseTimer) onPauseTimer(activeTimer.id);
              }}
              onResume={() => {
                if (activeTimer && onResumeTimer) onResumeTimer(activeTimer.id);
              }}
              onStop={() => {
                if (activeTimer && onStopTimer) onStopTimer(activeTimer.id);
              }}
            />
          )}
        </div>
        <div className="log-actions">
          <button
            className="ghost-button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(entry);
            }}
          >
            Edit
          </button>
          <button
            className="ghost-button danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(entry.id);
            }}
          >
            Delete
          </button>
        </div>
      </footer>
    </article>
  );
}
