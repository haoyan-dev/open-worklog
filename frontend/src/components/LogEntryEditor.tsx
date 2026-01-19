import React, { useState, useMemo, useEffect } from "react";
import { Paper, Stack, Select, Button, Group, Text, Box } from "@mantine/core";
import type { LogEntryEditorProps, LogEntryCreate, Category } from "../types";
import TimeSpanList from "./TimeSpanList";
import ProjectAutocomplete from "./ProjectAutocomplete";
import { calculateHoursFromTimeSpans, roundToQuarterHour } from "../utils/timeUtils";
import TaskEditor from "./TaskEditor";
import NoteEditor from "./NoteEditor";

const CATEGORIES: Category[] = [
  "Routine Work",
  "OKR",
  "Team Contribution",
  "Company Contribution",
];

export default function LogEntryEditor({
  entry,
  date,
  onSave,
  onCancel,
  timespans = [],
  onTimeSpanAdjust,
  onTimeSpanUpdate,
  onTimeSpanCreate,
  onTimeSpanDelete,
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

  const [taskError, setTaskError] = useState<string | null>(null);

  // Update form state when entry changes
  useEffect(() => {
    if (entry) {
      setFormState({
        date: entry.date,
        category: entry.category,
        project_id: entry.project_id,
        task: entry.task,
        hours: entry.hours,
        additional_hours: 0,
        status: entry.status || "Completed",
        notes: entry.notes || "",
      });
    }
  }, [entry]);

  // Total hours = TimeSpan hours only
  const totalHours = roundToQuarterHour(timespanHours);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.task || formState.task.trim().length === 0) {
      setTaskError("Task is required.");
      return;
    }
    setTaskError(null);
    // Total hours will be calculated on backend, but we send it for consistency
    onSave({
      ...formState,
      hours: totalHours,
      additional_hours: 0,
      date
    });
  };

  return (
    <Paper shadow="sm" p="lg" radius="md" withBorder>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group grow>
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Project
              </Text>
              <ProjectAutocomplete
                value={formState.project_id || null}
                onChange={(projectId) => {
                  setFormState((prev) => ({ ...prev, project_id: projectId }));
                }}
                required
              />
            </Box>
            <Select
              label="Category"
              value={formState.category}
              onChange={(value) => {
                if (value) {
                  setFormState((prev) => ({ ...prev, category: value as Category }));
                }
              }}
              data={CATEGORIES}
            />
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Hours
              </Text>
              <Box p="sm" style={{ backgroundColor: "var(--mantine-color-gray-0)", borderRadius: "var(--mantine-radius-sm)" }}>
                <Group justify="space-between" gap="xs">
                  <Text size="sm" fw={600}>Total hours:</Text>
                  <Text size="md" fw={700} c="blue">{totalHours.toFixed(2)}h</Text>
                </Group>
              </Box>
            </Box>
          </Group>

          {entry?.id ? (
            <Box>
              <TimeSpanList
                logEntryId={entry.id}
                timespans={timespans}
                collapsed={false}
                onAdjust={onTimeSpanAdjust}
                onUpdate={onTimeSpanUpdate}
                onCreate={onTimeSpanCreate}
                onDelete={onTimeSpanDelete}
              />
            </Box>
          ) : null}

          <TaskEditor
            label="Task"
            required
            value={formState.task}
            error={taskError}
            placeholder={"- [ ] Item 1\n- [ ] Item 2"}
            onChange={(markdown) => {
              setFormState((prev) => ({ ...prev, task: markdown }));
              if (taskError && markdown.trim().length > 0) {
                setTaskError(null);
              }
            }}
          />

          <NoteEditor
            label="Notes"
            value={formState.notes || ""}
            placeholder={"Add any notes (Markdown supported)"}
            onChange={(markdown) => {
              setFormState((prev) => ({ ...prev, notes: markdown }));
            }}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
