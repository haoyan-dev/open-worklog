import React, { useState } from "react";
import type { LogEntryEditorProps, LogEntryCreate, Category, TimeSpan } from "../types";
import TimeSpanList from "./TimeSpanList";

const CATEGORIES: Category[] = [
  "Routine Work",
  "OKR",
  "Team Contribution",
  "Company Contribution",
];

const HOUR_BUTTONS = [0.25, 0.5, 1, 2, 4, 8];

export default function LogEntryEditor({
  entry,
  date,
  onSave,
  onCancel,
  timespans = [],
}: LogEntryEditorProps & { timespans?: TimeSpan[] }) {
  const [formState, setFormState] = useState<LogEntryCreate>(
    entry || {
      date,
      category: "Routine Work",
      project: "",
      task: "",
      hours: 1,
      status: "Completed",
      notes: "",
    }
  );

  const updateField = (field: keyof LogEntryCreate) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value =
      field === "hours" ? Number(event.target.value) : event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ ...formState, date });
  };

  return (
    <form className="log-editor" onSubmit={handleSubmit}>
      <div className="log-editor-row">
        <label>
          Project
          <input
            value={formState.project}
            onChange={updateField("project")}
            required
          />
        </label>
        <label>
          Category
          <select
            value={formState.category}
            onChange={updateField("category")}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hours
          <div className="hours-input-group">
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={formState.hours}
              onChange={updateField("hours")}
              required
            />
            <div className="hour-buttons">
              {HOUR_BUTTONS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  className="hour-button"
                  onClick={() =>
                    setFormState((prev) => ({ ...prev, hours }))
                  }
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>
        </label>
      </div>
      <label>
        Task
        <textarea
          rows={3}
          value={formState.task}
          onChange={updateField("task")}
          required
        />
      </label>
      {timespans && timespans.length > 0 && (
        <div className="log-editor-timespans">
          <TimeSpanList timespans={timespans} collapsed={false} />
        </div>
      )}
      <label>
        Notes
        <textarea
          rows={3}
          value={formState.notes || ""}
          onChange={updateField("notes")}
        />
      </label>
      <div className="log-editor-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-button">
          Save
        </button>
      </div>
    </form>
  );
}
