import React, { useState, useMemo, useEffect } from "react";
import type { LogEntryEditorProps, LogEntryCreate, Category, TimeSpan } from "../types";
import TimeSpanList from "./TimeSpanList";

const CATEGORIES: Category[] = [
  "Routine Work",
  "OKR",
  "Team Contribution",
  "Company Contribution",
];

const HOUR_BUTTONS = [0.25, 0.5, 1, 2, 4, 8];

// Calculate hours from TimeSpans, rounded to 0.25 increments
function calculateHoursFromTimeSpans(timespans: TimeSpan[]): number {
  if (timespans.length === 0) return 0;
  
  const totalHours = timespans.reduce((total, span) => {
    const start = new Date(span.start_timestamp).getTime();
    const end = span.end_timestamp
      ? new Date(span.end_timestamp).getTime()
      : Date.now();
    const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
    return total + duration;
  }, 0);
  
  // Round to nearest 0.25 hour increment
  return Math.round(totalHours * 4) / 4;
}

// Round to nearest 0.25 hour increment
function roundToQuarterHour(hours: number): number {
  return Math.round(hours * 4) / 4;
}

export default function LogEntryEditor({
  entry,
  date,
  onSave,
  onCancel,
  timespans = [],
}: LogEntryEditorProps & { timespans?: TimeSpan[] }) {
  // Calculate hours from TimeSpans if they exist
  const calculatedHours = useMemo(
    () => calculateHoursFromTimeSpans(timespans),
    [timespans]
  );
  
  const hasTimeSpans = timespans.length > 0;
  
  const [formState, setFormState] = useState<LogEntryCreate>(
    entry || {
      date,
      category: "Routine Work",
      project: "",
      task: "",
      hours: 0,
      status: "Completed",
      notes: "",
    }
  );

  // Update hours when calculated hours change or when entry changes
  useEffect(() => {
    if (hasTimeSpans && calculatedHours > 0) {
      setFormState((prev) => ({ ...prev, hours: calculatedHours }));
    } else if (entry) {
      setFormState((prev) => ({ ...prev, hours: entry.hours || 0 }));
    }
  }, [calculatedHours, hasTimeSpans, entry]);

  const updateField = (field: keyof LogEntryCreate) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value =
      field === "hours" ? roundToQuarterHour(Number(event.target.value)) : event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // If TimeSpans exist, use calculated hours; otherwise use manual input (rounded)
    const finalHours = hasTimeSpans && calculatedHours > 0 
      ? calculatedHours 
      : roundToQuarterHour(formState.hours);
    onSave({ ...formState, hours: finalHours, date });
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
          {hasTimeSpans && calculatedHours > 0 ? (
            <div className="hours-display">
              <input
                type="number"
                value={calculatedHours.toFixed(2)}
                readOnly
                className="hours-readonly"
              />
              <span className="hours-source">(calculated from time spans)</span>
            </div>
          ) : (
            <div className="hours-input-group">
              <input
                type="number"
                min="0"
                step="0.25"
                value={formState.hours}
                onChange={updateField("hours")}
                required={false}
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
          )}
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
