import React from "react";
import ReactMarkdown from "react-markdown";
import type { LogEntryCardProps } from "../types";

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
}: LogEntryCardProps) {
  return (
    <article className="log-card" onClick={() => onEdit(entry)}>
      <header className="log-card-header">
        <div>
          <div className="log-project">{entry.project}</div>
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
      </section>
      <footer className="log-card-footer">
        <span>{entry.status || "Completed"}</span>
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
