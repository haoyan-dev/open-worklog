import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Card, Group, Stack, Text, Badge, ActionIcon, Box } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import type { LogEntryCardProps } from "../types";
import TimerControls from "./TimerControls";
import TimeSpanList from "./TimeSpanList";
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
  activeTimer,
  timespans = [],
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onStopTimer,
  onTimeSpanAdjust,
  onTimeSpanUpdate,
}: LogEntryCardProps) {
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

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        borderColor: activeTimer?.log_entry_id === entry.id ? "var(--mantine-color-green-6)" : undefined,
        borderWidth: activeTimer?.log_entry_id === entry.id ? 2 : undefined,
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

        <Box>
          <Box className="log-task">
            <ReactMarkdown>{entry.task}</ReactMarkdown>
          </Box>
          {entry.notes && (
            <Box mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
              <Text size="sm" c="dimmed">
                <ReactMarkdown>{entry.notes}</ReactMarkdown>
              </Text>
            </Box>
          )}
          {timespans && timespans.length > 0 && (
            <Box mt="md">
              <TimeSpanList 
                timespans={timespans}
                onAdjust={onTimeSpanAdjust}
                onUpdate={onTimeSpanUpdate}
              />
            </Box>
          )}
        </Box>

        <Group justify="space-between" align="center" style={{ borderTop: "1px solid var(--mantine-color-gray-3)", paddingTop: "var(--mantine-spacing-md)" }}>
          <Group gap="sm">
            <Badge color={statusColor} variant="light">
              {status}
            </Badge>
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
