import { useState, useEffect, useRef } from "react";
import { Paper, Stack, Box } from "@mantine/core";
import type { TimeSpan } from "../types";
import { parseUTCDate } from "../utils/timeUtils";
import TimeSpanSessionHeader from "./TimeSpanSessionHeader";
import TimeSpanAdjustButtons from "./TimeSpanAdjustButtons";
import SimpleTimeline from "./SimpleTimeline";

interface TimeSpanSessionProps {
  timespan: TimeSpan;
  index: number;
  onUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
  onAdjust?: (timespanId: number, hours: number) => void;
  onDelete?: (timespanId: number) => Promise<void>;
}

export default function TimeSpanSession({
  timespan,
  index,
  onUpdate,
  onAdjust,
  onDelete,
}: TimeSpanSessionProps) {
  console.log("[TimeSpanSession] render", {
    timespanId: timespan.id,
    index,
    hasOnUpdate: !!onUpdate,
    hasOnAdjust: !!onAdjust,
  });
  const prevTimespanRef = useRef<TimeSpan | null>(null);
  
  useEffect(() => {
    if (prevTimespanRef.current) {
      const prev = prevTimespanRef.current;
      const changed = 
        prev.id !== timespan.id ||
        prev.start_timestamp !== timespan.start_timestamp ||
        prev.end_timestamp !== timespan.end_timestamp;
      
      if (changed) {
        console.log("[TimeSpanSession] timespan prop changed", {
          timespanId: timespan.id,
          index,
          prev: {
            start_timestamp: prev.start_timestamp,
            end_timestamp: prev.end_timestamp,
          },
          current: {
            start_timestamp: timespan.start_timestamp,
            end_timestamp: timespan.end_timestamp,
          },
        });
      }
    } else {
      console.log("[TimeSpanSession] initial render", {
        timespanId: timespan.id,
        index,
      });
    }
    prevTimespanRef.current = timespan;
  }, [timespan, index]);
  const [isEditing, setIsEditing] = useState(false);

  // Parse timestamps as UTC to avoid timezone shifts
  const startTime = parseUTCDate(timespan.start_timestamp);
  const endTime = timespan.end_timestamp ? parseUTCDate(timespan.end_timestamp) : new Date();
  const isRunning = !timespan.end_timestamp;

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleTimeChange = (startTimestamp: string, endTimestamp: string) => {
    console.log("[TimeSpanSession] handleTimeChange called", {
      timespanId: timespan.id,
      startTimestamp,
      endTimestamp,
      currentStart: timespan.start_timestamp,
      currentEnd: timespan.end_timestamp,
    });
    if (onUpdate) {
      onUpdate(timespan.id, startTimestamp, endTimestamp);
    } else {
      console.log("[TimeSpanSession] handleTimeChange: onUpdate not provided");
    }
  };

  return (
    <Paper shadow="xs" p="sm" radius="sm" withBorder>
      <Stack gap="sm">
        <TimeSpanSessionHeader
          timespan={timespan}
          index={index}
          isEditing={isEditing}
          onToggleEdit={handleToggleEdit}
          onTimeRangeChange={(startTimestamp, endTimestamp) => {
            if (onUpdate) onUpdate(timespan.id, startTimestamp, endTimestamp);
          }}
          onDelete={
            onDelete
              ? async () => {
                  await onDelete(timespan.id);
                }
              : undefined
          }
        />

        <Box
          style={{
            width: "100%",
            minHeight: 102,
            borderRadius: "var(--mantine-radius-sm)",
            border: "1px solid var(--mantine-color-gray-3)",
            overflow: "hidden",
            backgroundColor: "white",
          }}
        >
          <SimpleTimeline
            startTime={startTime}
            endTime={endTime}
            isRunning={isRunning}
            isEditing={isEditing}
            onTimeChange={handleTimeChange}
            onToggleEdit={handleToggleEdit}
          />
        </Box>

        {isEditing && onAdjust && timespan.end_timestamp && (
          <TimeSpanAdjustButtons
            timespanId={timespan.id}
            startTime={startTime}
            endTime={endTime}
            onAdjust={onAdjust}
          />
        )}
      </Stack>
    </Paper>
  );
}
