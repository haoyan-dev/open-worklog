import React, { useState, useMemo, useEffect } from "react";
import type { LogEntryEditorProps, LogEntryCreate, Category } from "../types";
import TimeSpanList from "./TimeSpanList";
import ProjectAutocomplete from "./ProjectAutocomplete";
import { calculateHoursFromTimeSpans, roundToQuarterHour } from "../utils/timeUtils";

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
  onTimeSpanAdjust,
  onTimeSpanUpdate,
}: LogEntryEditorProps) {
  console.log("[LogEntryEditor] render", {
    entryId: entry?.id,
    timespansCount: timespans.length,
    hasOnTimeSpanUpdate: !!onTimeSpanUpdate,
    hasOnTimeSpanAdjust: !!onTimeSpanAdjust,
  });
  // Calculate hours from TimeSpans (primary source)
  const timespanHours = useMemo(
    () => calculateHoursFromTimeSpans(timespans),
    [timespans]
  );
  
  const [formState, setFormState] = useState<LogEntryCreate>(
    entry || {
      date,
      category: "Routine Work",
      project_id: 0,
      task: "",
      hours: 0,
      additional_hours: 0,
      status: "Completed",
      notes: "",
    }
  );

  // Update form state when entry changes
  useEffect(() => {
    if (entry) {
      setFormState({
        date: entry.date,
        category: entry.category,
        project_id: entry.project_id,
        task: entry.task,
        hours: entry.hours,
        additional_hours: entry.additional_hours || 0,
        status: entry.status || "Completed",
        notes: entry.notes || "",
      });
    }
  }, [entry]);

  const updateField = (field: keyof LogEntryCreate) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value =
      field === "additional_hours" 
        ? roundToQuarterHour(Number(event.target.value)) 
        : event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate total hours = TimeSpan hours + additional hours
  const totalHours = roundToQuarterHour(timespanHours + formState.additional_hours);
  
  const [adjustPanelExpanded, setAdjustPanelExpanded] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Total hours will be calculated on backend, but we send it for consistency
    onSave({ 
      ...formState, 
      hours: totalHours,
      additional_hours: formState.additional_hours,
      date 
    });
  };

  return (
    <form className="log-editor" onSubmit={handleSubmit}>
      <div className="log-editor-row">
        <label>
          Project
          <ProjectAutocomplete
            value={formState.project_id || null}
            onChange={(projectId) => {
              setFormState((prev) => ({ ...prev, project_id: projectId }));
            }}
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
          <div className="hours-section">
            <div className="hours-breakdown">
              <div className="hours-row">
                <span className="hours-label">TimeSpan hours:</span>
                <span className="hours-value readonly">{timespanHours.toFixed(2)}h</span>
              </div>
              <div className="hours-row">
                <span className="hours-label">Additional hours:</span>
                <span className="hours-value readonly">{formState.additional_hours.toFixed(2)}h</span>
              </div>
              <div className="hours-adjust-panel">
                <div
                  className="hours-adjust-header"
                  onClick={() => setAdjustPanelExpanded(!adjustPanelExpanded)}
                >
                  <span>Adjust hours</span>
                  <span className="hours-adjust-toggle">{adjustPanelExpanded ? "▲" : "▼"}</span>
                </div>
                {adjustPanelExpanded && (
                  <div className="hours-adjust-content">
                    <div className="hour-buttons-group">
                      {HOUR_BUTTONS.map((hourValue) => (
                        <div key={hourValue} className="hour-button-group">
                          <span className="hour-button-label">{hourValue}h</span>
                          <button
                            type="button"
                            className="hour-button add"
                            onClick={() => {
                              const newAdditional = roundToQuarterHour(formState.additional_hours + hourValue);
                              setFormState((prev) => ({ ...prev, additional_hours: newAdditional }));
                            }}
                            title={`Add ${hourValue}h`}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="hour-button subtract"
                            onClick={() => {
                              const newAdditional = Math.max(0, roundToQuarterHour(formState.additional_hours - hourValue));
                              setFormState((prev) => ({ ...prev, additional_hours: newAdditional }));
                            }}
                            disabled={formState.additional_hours < hourValue}
                            title={`Subtract ${hourValue}h`}
                          >
                            -
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="hours-row total">
                <span className="hours-label">Total hours:</span>
                <span className="hours-value total">{totalHours.toFixed(2)}h</span>
              </div>
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
          <TimeSpanList 
            timespans={timespans} 
            collapsed={false}
            onAdjust={onTimeSpanAdjust}
            onUpdate={onTimeSpanUpdate}
          />
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
