import { useEffect, useMemo, useState } from "react";
import { Card, Group, Stack, Text, Badge, ActionIcon, Box } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import type { LogEntryCardProps } from "../types";
import TimerControls from "./TimerControls";
import TimeSpanList from "./TimeSpanList";
import MarkdownViewer from "./MarkdownViewer";
import { calculateHoursFromTimeSpans, roundToQuarterHour } from "../utils/timeUtils";

const CATEGORY_COLORS: Record<string, string> = {
  "Routine Work": "blue",
  OKR: "orange",
  "Team Contribution": "green",
  "Company Contribution": "violet",
};

export default function LogEntryCard({
  entry,
  onEdit,
  onDelete,
  activeTimeSpan,
  timespans = [],
  onStartSession,
  onPauseSession,
  onStopSession,
  onTimeSpanAdjust,
  onTimeSpanUpdate,
  onTimeSpanCreate,
  onTimeSpanDelete,
  onTaskMarkdownChange,
}: LogEntryCardProps) {
  const currentActive = activeTimeSpan ?? null;
  // Calculate hours from timespans when available, otherwise use entry.hours
  // This ensures the displayed hours match what's shown in TimeSpanList
  const displayHours = useMemo(() => {
    if (timespans && timespans.length > 0) {
      const timespanHours = calculateHoursFromTimeSpans(timespans);
      const additionalHours = entry.additional_hours || 0;
      return roundToQuarterHour(timespanHours + additionalHours);
    }
    // Fall back to entry.hours if timespans aren't loaded yet
    return entry.hours;
  }, [timespans, entry.hours, entry.additional_hours]);

  const status = entry.status || "Completed";

  const statusColorMap: Record<string, string> = {
    completed: "green",
    "in-progress": "blue",
    "inprogress": "blue",
    pending: "orange",
    blocked: "red",
  };

  const statusColor = statusColorMap[status.toLowerCase().replace(/\s+/g, "-")] || "gray";

  const [taskMarkdown, setTaskMarkdown] = useState<string>(entry.task);
  const [taskDirty, setTaskDirty] = useState<boolean>(false);

  // When switching to a different entry, always sync from server value.
  useEffect(() => {
    setTaskMarkdown(entry.task);
    setTaskDirty(false);
  }, [entry.id]);

  // If not dirty, keep in sync with server; if dirty, clear dirty once server matches our local state.
  useEffect(() => {
    if (!taskDirty) {
      setTaskMarkdown(entry.task);
      return;
    }
    if (entry.task === taskMarkdown) {
      setTaskDirty(false);
    }
  }, [entry.task, taskDirty, taskMarkdown]);

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        borderColor: currentActive?.log_entry_id === entry.id ? "var(--mantine-color-green-6)" : undefined,
        borderWidth: currentActive?.log_entry_id === entry.id ? 2 : undefined,
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600} size="lg">
              {entry.project_name || `Project #${entry.project_id}`}
            </Text>
            <Badge color={CATEGORY_COLORS[entry.category] || "gray"}>
              {entry.category}
            </Badge>
          </Stack>
          <Text fw={700} size="xl">
            {displayHours.toFixed(1)}h
          </Text>
        </Group>

        <Box p="sm" style={{ backgroundColor: "var(--mantine-color-gray-0)", borderRadius: "var(--mantine-radius-sm)", border: "1px solid var(--mantine-color-gray-3)" }}>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb={6}>
            Tasks
          </Text>

          <Box className="log-task" mb="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
            <MarkdownViewer
              value={taskMarkdown}
              enableTaskToggle
              onChange={(nextMarkdown) => {
                setTaskDirty(true);
                setTaskMarkdown(nextMarkdown);
                onTaskMarkdownChange?.(entry.id, nextMarkdown);
              }}
            />
          </Box>

          {entry.notes && (
            <Box mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
              <Text size="sm" c="dimmed">
                <MarkdownViewer value={entry.notes} />
              </Text>
            </Box>
          )}

        </Box>

        <Box mt="md">
          <TimeSpanList
            logEntryId={entry.id}
            timespans={timespans}
            onAdjust={onTimeSpanAdjust}
            onUpdate={onTimeSpanUpdate}
            onCreate={onTimeSpanCreate}
            onDelete={onTimeSpanDelete}
          />
        </Box>

        <Group justify="space-between" align="center" style={{ borderTop: "1px solid var(--mantine-color-gray-3)", paddingTop: "var(--mantine-spacing-md)" }}>
          <Group gap="sm">
            <Badge color={statusColor} variant="light">
              {status}
            </Badge>
            {onStartSession && (
              <TimerControls
                activeTimeSpan={currentActive}
                entryId={entry.id}
                timespans={timespans}
                disabled={false}
                onStart={() => {
                  onStartSession(entry.id);
                }}
                onPause={() => {
                  if (currentActive && onPauseSession) onPauseSession(currentActive.id);
                }}
                onStop={() => {
                  if (currentActive && onStopSession) onStopSession(currentActive.id);
                }}
              />
            )}
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(entry);
              }}
              title="Edit entry"
              aria-label="Edit entry"
            >
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(entry.id);
              }}
              title="Delete entry"
              aria-label="Delete entry"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
