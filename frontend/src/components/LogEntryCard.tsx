import { useEffect, useMemo, useState } from "react";
import { Card, Group, Stack, Text, Badge, ActionIcon, Box, Collapse, Tooltip } from "@mantine/core";
import { IconChevronDown, IconCopy, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
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
  cardNumber,
  expanded,
  onToggleExpanded,
  onEdit,
  onDelete,
  onNewDraftFromEntry,
  onDuplicateEntry,
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
      <Card.Section inheritPadding py="sm">
        <Box
          onClick={() => onToggleExpanded(entry.id)}
          style={{
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
              <Text
                size="sm"
                c="dimmed"
                fw={600}
                style={{ fontFamily: "monospace", width: 40, flex: "0 0 auto" }}
              >
                #{cardNumber}
              </Text>
              <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} size="lg" lineClamp={1}>
                  {entry.project_name || `Project #${entry.project_id}`}
                </Text>
                <Badge color={CATEGORY_COLORS[entry.category] || "gray"}>
                  {entry.category}
                </Badge>
              </Stack>
            </Group>

            <Group gap="xs" wrap="nowrap" align="center">
              <Text fw={700} size="xl">
                {displayHours.toFixed(1)}h
              </Text>
              <Tooltip label={expanded ? "Collapse" : "Expand"} withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpanded(entry.id);
                  }}
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <IconChevronDown
                    size={18}
                    style={{
                      transform: expanded ? "rotate(180deg)" : undefined,
                      transition: "transform 150ms ease",
                    }}
                  />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Box>
      </Card.Section>

      {expanded ? (
        <Card.Section inheritPadding py="md" withBorder>
          <Collapse in={expanded}>
            <Stack gap="md">
              <Box
                p="sm"
                style={{
                  backgroundColor: "var(--mantine-color-gray-0)",
                  borderRadius: "var(--mantine-radius-sm)",
                  border: "1px solid var(--mantine-color-gray-3)",
                }}
              >
                <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb={6}>
                  Tasks
                </Text>

                <Box
                  className="log-task"
                  mb="md"
                  pt="md"
                  style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
                >
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

              <Box>
                <TimeSpanList
                  logEntryId={entry.id}
                  timespans={timespans}
                  onAdjust={onTimeSpanAdjust}
                  onUpdate={onTimeSpanUpdate}
                  onCreate={onTimeSpanCreate}
                  onDelete={onTimeSpanDelete}
                />
              </Box>

              {entry.previous_task_uuid ? (
                <Text size="xs" c="dimmed">
                  Duplicated from {entry.previous_task_uuid.slice(0, 8)}…
                </Text>
              ) : null}
            </Stack>
          </Collapse>
        </Card.Section>
      ) : null}

      <Card.Section inheritPadding py="sm" withBorder>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Badge color={statusColor} variant="light">
              {status}
            </Badge>
            {onStartSession ? (
              <TimerControls
                mode="status"
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
            ) : null}
          </Group>
          <Group gap="xs">
            {onStartSession ? (
              <TimerControls
                mode="actions"
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
            ) : null}
            {onNewDraftFromEntry && (
              <Tooltip label="New draft from this" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={(event) => {
                    event.stopPropagation();
                    onNewDraftFromEntry(entry);
                  }}
                  aria-label="New draft from this"
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {onDuplicateEntry && (
              <Tooltip label="Duplicate…" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicateEntry(entry);
                  }}
                  aria-label="Duplicate…"
                >
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Edit entry" withArrow>
              <ActionIcon
                variant="subtle"
                color="blue"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(entry);
                }}
                aria-label="Edit entry"
              >
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete entry" withArrow>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(entry.id);
                }}
                aria-label="Delete entry"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Card.Section>
    </Card>
  );
}
