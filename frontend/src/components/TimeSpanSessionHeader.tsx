import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Stack, Text, Button, Divider, ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { DateInput, TimePicker } from "@mantine/dates";
import { formatDateTime, formatDuration, parseUTCDate } from "../utils/timeUtils";
import type { TimeSpan } from "../types";

interface TimeSpanSessionHeaderProps {
  timespan: TimeSpan;
  index: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onTimeRangeChange?: (startTimestamp: string, endTimestamp: string) => void;
  onDelete?: () => Promise<void>;
}

function toTimeValue(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

export default function TimeSpanSessionHeader({
  timespan,
  index,
  isEditing,
  onToggleEdit,
  onTimeRangeChange,
  onDelete,
}: TimeSpanSessionHeaderProps) {
  const prevTimespanRef = useRef<TimeSpan | null>(null);
  const [startValue, setStartValue] = useState<string>("");
  const [endValue, setEndValue] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  
  useEffect(() => {
    if (prevTimespanRef.current) {
      const prev = prevTimespanRef.current;
      const changed = 
        prev.id !== timespan.id ||
        prev.start_timestamp !== timespan.start_timestamp ||
        prev.end_timestamp !== timespan.end_timestamp;
      
      if (changed) {
        console.log("[TimeSpanSessionHeader] timespan prop changed", {
          timespanId: timespan.id,
          prev: {
            start_timestamp: prev.start_timestamp,
            end_timestamp: prev.end_timestamp,
          },
          current: {
            start_timestamp: timespan.start_timestamp,
            end_timestamp: timespan.end_timestamp,
          },
          // Log parsed dates for debugging
          prevParsed: {
            start: prev.start_timestamp ? new Date(prev.start_timestamp).toISOString() : null,
            end: prev.end_timestamp ? new Date(prev.end_timestamp).toISOString() : null,
          },
          currentParsed: {
            start: timespan.start_timestamp ? new Date(timespan.start_timestamp).toISOString() : null,
            end: timespan.end_timestamp ? new Date(timespan.end_timestamp).toISOString() : null,
          },
        });
      } else {
        console.log("[TimeSpanSessionHeader] timespan prop unchanged", {
          timespanId: timespan.id,
        });
      }
    } else {
      console.log("[TimeSpanSessionHeader] initial render", {
        timespanId: timespan.id,
        start_timestamp: timespan.start_timestamp,
        end_timestamp: timespan.end_timestamp,
      });
    }
    prevTimespanRef.current = timespan;
  }, [timespan]);

  // Sync local picker values when entering edit mode or when the timespan changes.
  useEffect(() => {
    if (!isEditing) return;
    const start = parseUTCDate(timespan.start_timestamp);
    setStartValue(toTimeValue(start));
    setStartDate(start);

    if (timespan.end_timestamp) {
      const end = parseUTCDate(timespan.end_timestamp);
      setEndValue(toTimeValue(end));
      setEndDate(end);
    } else {
      setEndValue("");
      setEndDate(null);
    }

    setDirty(false);
  }, [isEditing, timespan.start_timestamp, timespan.end_timestamp]);

  const canEditTimeRange = useMemo(() => {
    return Boolean(timespan.end_timestamp);
  }, [timespan.end_timestamp]);

  const hasValidValues =
    canEditTimeRange &&
    Boolean(onTimeRangeChange) &&
    Boolean(startValue) &&
    Boolean(endValue) &&
    Boolean(startDate) &&
    Boolean(endDate);

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = window.confirm("Delete this session?");
    if (!ok) return;
    await onDelete();
  };

  const handleSave = () => {
    if (!hasValidValues || !dirty || !onTimeRangeChange || !startDate || !endDate) return;
    const nextStart = withLocalDateAndTime(startDate, startValue);
    const nextEnd = withLocalDateAndTime(endDate, endValue);
    if (nextStart && nextEnd) {
      onTimeRangeChange(nextStart, nextEnd);
    }
    onToggleEdit();
  };

  const handleCancel = () => {
    onToggleEdit();
  };
  
  return (
    <Stack gap="xs">
      {/* Read-only header row */}
      <Group justify="space-between" align="flex-start">
        <Group gap="md" style={{ flex: 1 }}>
          <Text size="xs" fw={600} c="dimmed">
            #{index + 1}
          </Text>
          {!isEditing && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {formatDateTime(timespan.start_timestamp)}
                {timespan.end_timestamp ? (
                  <> → {formatDateTime(timespan.end_timestamp)}</>
                ) : (
                  " → (running)"
                )}
              </Text>
              <Text size="sm" fw={600}>
                {formatDuration(timespan.start_timestamp, timespan.end_timestamp)}
              </Text>
            </Stack>
          )}
        </Group>

        {!isEditing && (
          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <Button
              size="xs"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEdit();
              }}
            >
              Edit
            </Button>
            {onDelete && (
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete();
                }}
                title="Delete session"
                aria-label="Delete session"
              >
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        )}
      </Group>

      {/* Independent editor layout + buttons */}
      {isEditing && (
        <>
          <Divider />
          {canEditTimeRange ? (
            <Stack gap="xs">
              <Group gap="xs" align="center" wrap="wrap">
                <DateInput
                  value={startDate}
                  onChange={(d) => {
                    setStartDate(d);
                    setDirty(true);
                  }}
                  size="xs"
                  valueFormat="MMM D"
                  aria-label="Start date"
                />
                <TimePicker
                  value={startValue}
                  onChange={(v) => {
                    setStartValue(v);
                    setDirty(true);
                  }}
                  minutesStep={15}
                  withDropdown
                  size="xs"
                  aria-label="Start time"
                />
                <Text size="xs" c="dimmed">
                  →
                </Text>
                <DateInput
                  value={endDate}
                  onChange={(d) => {
                    setEndDate(d);
                    setDirty(true);
                  }}
                  size="xs"
                  valueFormat="MMM D"
                  aria-label="End date"
                />
                <TimePicker
                  value={endValue}
                  onChange={(v) => {
                    setEndValue(v);
                    setDirty(true);
                  }}
                  minutesStep={15}
                  withDropdown
                  size="xs"
                  aria-label="End time"
                />
              </Group>

              <Group justify="flex-end" gap="xs">
                <Button
                  size="xs"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  disabled={!dirty || !hasValidValues}
                >
                  Save
                </Button>
              </Group>
            </Stack>
          ) : (
            <Group justify="flex-end" gap="xs">
              <Text size="xs" c="dimmed">
                Cannot edit a running session until it has an end time.
              </Text>
              <Button
                size="xs"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
              >
                Close
              </Button>
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}
