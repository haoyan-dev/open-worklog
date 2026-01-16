import React, { useState } from "react";

const CATEGORIES = [
  "Routine Work",
  "OKR",
  "Team Contribution",
  "Company Contribution",
];

export default function LogEntryEditor({ entry, date, onSave, onCancel }) {
  const [formState, setFormState] = useState(
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

  const updateField = (field) => (event) => {
    const value =
      field === "hours" ? Number(event.target.value) : event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
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
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={formState.hours}
            onChange={updateField("hours")}
            required
          />
        </label>
      </div>
      <label>
        Task
        <textarea
          rows="3"
          value={formState.task}
          onChange={updateField("task")}
          required
        />
      </label>
      <label>
        Notes
        <textarea
          rows="3"
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
