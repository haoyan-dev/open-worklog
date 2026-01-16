import { useEffect, useRef } from "react";
import { Group, Stack, Text, Button } from "@mantine/core";
import { formatDateTime, formatDuration } from "../utils/timeUtils";
import type { TimeSpan } from "../types";

interface TimeSpanSessionHeaderProps {
  timespan: TimeSpan;
  index: number;
  isEditing: boolean;
  onToggleEdit: () => void;
}

export default function TimeSpanSessionHeader({
  timespan,
  index,
  isEditing,
  onToggleEdit,
}: TimeSpanSessionHeaderProps) {
  const prevTimespanRef = useRef<TimeSpan | null>(null);
  
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
  
  return (
    <Group justify="space-between" align="flex-start">
      <Group gap="md" style={{ flex: 1 }}>
        <Text size="xs" fw={600} c="dimmed">
          #{index + 1}
        </Text>
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
      </Group>
      <Button
        size="xs"
        variant="subtle"
        onClick={(e) => {
          e.stopPropagation();
          onToggleEdit();
        }}
      >
        {isEditing ? "Done" : "Edit"}
      </Button>
    </Group>
  );
}
