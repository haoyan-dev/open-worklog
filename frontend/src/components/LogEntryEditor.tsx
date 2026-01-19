import React, { useState, useMemo, useEffect } from "react";
import {
  Paper,
  Stack,
  Select,
  Button,
  Group,
  Text,
  Box,
  Grid,
  Divider,
  Anchor,
} from "@mantine/core";
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
  seed,
  onSave,
  onCancel,
  onOpenByUuid,
  timespans = [],
  activeTimeSpan,
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

  const initialCreateState = useMemo<LogEntryCreate>(() => {
    const seeded = seed ?? {};
    return {
      date,
      category: (seeded.category as Category) || "Routine Work",
      project_id: seeded.project_id ?? 0,
      task: "", // always blank for seeded create-mode
      hours: 0,
      additional_hours: 0,
      status: seeded.status ?? "Completed",
      notes: "", // always blank for seeded create-mode
      previous_task_uuid: seeded.previous_task_uuid,
    };
  }, [date, seed]);

  const [formState, setFormState] = useState<LogEntryCreate>(
    entry || initialCreateState
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
        additional_hours: entry.additional_hours ?? 0,
        status: entry.status || "Completed",
        notes: entry.notes || "",
        previous_task_uuid: entry.previous_task_uuid,
      });
      setTaskError(null);
      return;
    }

    // Create-mode: keep in sync with date/seed.
    setFormState(initialCreateState);
    setTaskError(null);
  }, [entry, initialCreateState]);

  const additionalHours = formState.additional_hours || 0;
  const sessionHours = roundToQuarterHour(timespanHours);
  const totalHours = roundToQuarterHour(timespanHours + additionalHours);

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
      date
    });
  };

  return (
    <Paper shadow="sm" p="lg" radius="md" withBorder>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Top bar */}
          <Group align="flex-end" wrap="wrap" gap="md">
            <Box style={{ flex: 1, minWidth: 260 }}>
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
            <Box style={{ width: 220, minWidth: 200 }}>
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
            </Box>
          </Group>

          <Divider />

          {/* Body */}
          <Box style={{ paddingBottom: 72 }}>
            <Grid gutter="md" align="flex-start">
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="md">
                  <TaskEditor
                    label="Task"
                    required
                    value={formState.task}
                    error={taskError}
                    placeholder={"- [ ] Item 1\n- [ ] Item 2"}
                    minHeight={220}
                    onChange={(markdown) => {
                      setFormState((prev) => ({ ...prev, task: markdown }));
                      if (taskError && markdown.trim().length > 0) {
                        setTaskError(null);
                      }
                    }}
                  />

                  <Box>
                    <Text size="sm" fw={600} mb={6}>
                      Sessions
                    </Text>
                    {entry?.id ? (
                      <TimeSpanList
                        logEntryId={entry.id}
                        timespans={timespans}
                        activeTimeSpan={activeTimeSpan}
                        collapsed={false}
                        onAdjust={onTimeSpanAdjust}
                        onUpdate={onTimeSpanUpdate}
                        onCreate={onTimeSpanCreate}
                        onDelete={onTimeSpanDelete}
                      />
                    ) : (
                      <Box
                        p="sm"
                        style={{
                          backgroundColor: "var(--mantine-color-gray-0)",
                          borderRadius: "var(--mantine-radius-sm)",
                          border: "1px dashed var(--mantine-color-gray-3)",
                        }}
                      >
                        <Text size="sm" c="dimmed">
                          Sessions will be available after you save this entry.
                        </Text>
                      </Box>
                    )}
                  </Box>

                  <NoteEditor
                    label="Notes"
                    value={formState.notes || ""}
                    placeholder={"Add any notes (Markdown supported)"}
                    minHeight={160}
                    onChange={(markdown) => {
                      setFormState((prev) => ({ ...prev, notes: markdown }));
                    }}
                  />
                </Stack>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="md">
                  <Box>
                    <Text size="sm" fw={600} mb={6}>
                      Hours
                    </Text>
                    <Box
                      p="sm"
                      style={{
                        backgroundColor: "var(--mantine-color-gray-0)",
                        borderRadius: "var(--mantine-radius-sm)",
                        border: "1px solid var(--mantine-color-gray-2)",
                      }}
                    >
                      <Group justify="space-between" gap="xs">
                        <Text size="sm" fw={600}>
                          Total
                        </Text>
                        <Text size="lg" fw={800} c="blue">
                          {totalHours.toFixed(2)}h
                        </Text>
                      </Group>
                      <Group justify="space-between" gap="xs" mt={8}>
                        <Text size="xs" c="dimmed">
                          From sessions
                        </Text>
                        <Text size="xs" c="dimmed">
                          {sessionHours.toFixed(2)}h
                        </Text>
                      </Group>
                      <Group justify="space-between" gap="xs" mt={4}>
                        <Text size="xs" c="dimmed">
                          Additional
                        </Text>
                        <Text size="xs" c="dimmed">
                          {additionalHours.toFixed(2)}h
                        </Text>
                      </Group>
                      <Group justify="space-between" gap="xs" mt={4}>
                        <Text size="xs" c="dimmed">
                          Sessions
                        </Text>
                        <Text size="xs" c="dimmed">
                          {entry?.id ? `${timespans.length}` : "—"}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed" mt={6}>
                        {entry?.id
                          ? "Total = sessions + additional hours."
                          : "Save first to start tracking sessions."}
                      </Text>
                    </Box>
                  </Box>

                  <Box>
                    <Text size="sm" fw={600} mb={6}>
                      Details
                    </Text>
                    <Stack gap="sm">
                      <Box>
                        <Text size="xs" c="dimmed">
                          Date
                        </Text>
                        <Text size="sm">{date}</Text>
                      </Box>

                      <Box>
                        <Text size="xs" c="dimmed">
                          Status
                        </Text>
                        <Text size="sm">{formState.status || "Completed"}</Text>
                      </Box>

                      <Box>
                        <Text size="xs" c="dimmed">
                          Additional hours
                        </Text>
                        <Text size="sm">{additionalHours.toFixed(2)}h</Text>
                      </Box>

                      {entry?.id ? (
                        <Box>
                          <Text size="xs" c="dimmed">
                            ID
                          </Text>
                          <Text size="sm">{entry.id}</Text>
                        </Box>
                      ) : null}
                      {entry?.uuid ? (
                        <Box>
                          <Text size="xs" c="dimmed">
                            UUID
                          </Text>
                          <Text size="sm" style={{ wordBreak: "break-word", fontFamily: "monospace" }}>
                            {entry.uuid}
                          </Text>
                        </Box>
                      ) : null}

                      {(entry?.previous_task_uuid || formState.previous_task_uuid) ? (
                        <Box>
                          <Text size="xs" c="dimmed">
                            Previous task UUID
                          </Text>
                          <Anchor
                            component="button"
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              const targetUuid = entry?.previous_task_uuid || formState.previous_task_uuid;
                              if (!targetUuid) return;
                              onOpenByUuid?.(targetUuid);
                            }}
                            style={{ wordBreak: "break-word", fontFamily: "monospace" }}
                          >
                            {entry?.previous_task_uuid || formState.previous_task_uuid}
                          </Anchor>
                        </Box>
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>
              </Grid.Col>
            </Grid>
          </Box>

          {/* Sticky footer */}
          <Box
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 10,
              background: "var(--mantine-color-body)",
              borderTop: "1px solid var(--mantine-color-gray-3)",
              paddingTop: "var(--mantine-spacing-sm)",
              paddingBottom: "var(--mantine-spacing-sm)",
            }}
          >
            <Group justify="flex-end">
              <Button type="button" variant="subtle" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </Group>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
}
