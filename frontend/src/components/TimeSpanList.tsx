import { useEffect, useMemo, useState } from "react";
import { Collapse, Stack, Group, Text, Box, Button, Divider } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { DateInput, TimePicker } from "@mantine/dates";
import type { TimeSpan } from "../types";
import { parseUTCDate } from "../utils/timeUtils";
import TimeSpanSession from "./TimeSpanSession";

interface TimeSpanListProps {
  logEntryId: number;
  timespans: TimeSpan[];
  collapsed?: boolean;
  onAdjust?: (timespanId: number, hours: number) => void;
  onUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
  onCreate?: (startTimestamp: string, endTimestamp: string) => Promise<void>;
  onDelete?: (timespanId: number) => Promise<void>;
}

function toTimeValue(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function snapDateToQuarterHour(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  d.setMinutes(roundedMinutes, 0, 0);
  return d;
}

function parseTimeValue(value: string): { hours: number; minutes: number; seconds: number } | null {
  const parts = value.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = parts.length >= 3 ? Number(parts[2]) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return { hours, minutes, seconds };
}

function withLocalDateAndTime(localDate: Date, timeValue: string): string | null {
  const t = parseTimeValue(timeValue);
  if (!t) return null;
  const nextLocal = new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    t.hours,
    t.minutes,
    t.seconds,
    0
  );
  return nextLocal.toISOString();
}

export default function TimeSpanList({
  logEntryId,
  timespans,
  collapsed: initiallyCollapsed = true,
  onAdjust,
  onUpdate,
  onCreate,
  onDelete,
}: TimeSpanListProps) {
  console.log("[TimeSpanList] render", {
    logEntryId,
    timespansCount: timespans.length,
    hasOnUpdate: !!onUpdate,
    hasOnAdjust: !!onAdjust,
    hasOnCreate: !!onCreate,
  });
  const [opened, { toggle }] = useDisclosure(!initiallyCollapsed);
  const [isAdding, setIsAdding] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startValue, setStartValue] = useState<string>("");
  const [endValue, setEndValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canCreate = Boolean(onCreate);

  // Parse timestamps as UTC to avoid timezone shifts
  const totalHours = timespans.reduce((total, span) => {
    const start = parseUTCDate(span.start_timestamp).getTime();
    const end = span.end_timestamp
      ? parseUTCDate(span.end_timestamp).getTime()
      : Date.now();
    return total + (end - start) / (1000 * 60 * 60);
  }, 0);

  const initialDraft = useMemo(() => {
    const last = timespans[timespans.length - 1];
    const base = last?.end_timestamp ? parseUTCDate(last.end_timestamp) : new Date();
    const start = snapDateToQuarterHour(base);
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    return { start, end };
  }, [timespans]);

  useEffect(() => {
    if (!isAdding) return;
    setStartDate(initialDraft.start);
    setEndDate(initialDraft.end);
    setStartValue(toTimeValue(initialDraft.start));
    setEndValue(toTimeValue(initialDraft.end));
    setIsSaving(false);
    setSaveError(null);
  }, [isAdding, initialDraft.start, initialDraft.end]);

  const isDraftValid = Boolean(
    startDate &&
    endDate &&
    startValue &&
    endValue &&
    parseTimeValue(startValue) &&
    parseTimeValue(endValue)
  );

  return (
    <Box p="sm" style={{ backgroundColor: "var(--mantine-color-gray-0)", borderRadius: "var(--mantine-radius-sm)", border: "1px solid var(--mantine-color-gray-3)" }}>
      <Group justify="space-between" align="center">
        <Group style={{ cursor: "pointer" }} onClick={toggle} gap="xs">
          <Text size="sm" fw={500}>
            {timespans.length} session{timespans.length !== 1 ? "s" : ""},{" "}
            {totalHours.toFixed(2)}h total
          </Text>
          <Text size="xs" c="dimmed">{opened ? "▲" : "▼"}</Text>
        </Group>
        {canCreate && (
          <Button
            size="xs"
            variant="light"
            onClick={(e) => {
              e.stopPropagation();
              if (!opened) toggle();
              setIsAdding(true);
            }}
          >
            Add
          </Button>
        )}
      </Group>
      <Collapse in={opened}>
        <Stack gap="sm" mt="sm">
          {canCreate && isAdding && (
            <Stack gap="xs">
              <Divider />
              <Group gap="xs" align="center" wrap="wrap">
                <DateInput
                  value={startDate}
                  onChange={(d) => {
                    setStartDate(d as Date | null);
                    setSaveError(null);
                  }}
                  size="xs"
                  valueFormat="MMM D"
                  aria-label="New session start date"
                />
                <TimePicker
                  value={startValue}
                  onChange={(v) => {
                    setStartValue(v);
                    setSaveError(null);
                  }}
                  minutesStep={15}
                  withDropdown
                  size="xs"
                  aria-label="New session start time"
                />
                <Text size="xs" c="dimmed">
                  →
                </Text>
                <DateInput
                  value={endDate}
                  onChange={(d) => {
                    setEndDate(d as Date | null);
                    setSaveError(null);
                  }}
                  size="xs"
                  valueFormat="MMM D"
                  aria-label="New session end date"
                />
                <TimePicker
                  value={endValue}
                  onChange={(v) => {
                    setEndValue(v);
                    setSaveError(null);
                  }}
                  minutesStep={15}
                  withDropdown
                  size="xs"
                  aria-label="New session end time"
                />
              </Group>
              {saveError && (
                <Text size="xs" c="red">
                  {saveError}
                </Text>
              )}
              <Group justify="flex-end" gap="xs">
                <Button
                  size="xs"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdding(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  loading={isSaving}
                  disabled={!isDraftValid || isSaving}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!onCreate || !startDate || !endDate) return;
                    const nextStart = withLocalDateAndTime(startDate, startValue);
                    const nextEnd = withLocalDateAndTime(endDate, endValue);
                    if (!nextStart || !nextEnd) {
                      setSaveError("Please enter a valid start and end time.");
                      return;
                    }
                    try {
                      setIsSaving(true);
                      setSaveError(null);
                      await onCreate(nextStart, nextEnd);
                      setIsAdding(false);
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : "Failed to create session.";
                      setSaveError(message);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  Save
                </Button>
              </Group>
            </Stack>
          )}
          {timespans.map((span, index) => (
            <TimeSpanSession
              key={`${span.id}-${span.start_timestamp}-${span.end_timestamp || 'running'}`}
              timespan={span}
              index={index}
              onUpdate={onUpdate}
              onAdjust={onAdjust}
              onDelete={onDelete ? (timespanId: number) => onDelete(timespanId) : undefined}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
