import { useState } from "react";
import { Collapse, Stack, Group, Text, Box } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { TimeSpan } from "../types";
import { parseUTCDate } from "../utils/timeUtils";
import TimeSpanSession from "./TimeSpanSession";

interface TimeSpanListProps {
  timespans: TimeSpan[];
  collapsed?: boolean;
  onAdjust?: (timespanId: number, hours: number) => void;
  onUpdate?: (timespanId: number, startTimestamp: string, endTimestamp?: string) => void;
}

export default function TimeSpanList({
  timespans,
  collapsed: initiallyCollapsed = true,
  onAdjust,
  onUpdate,
}: TimeSpanListProps) {
  console.log("[TimeSpanList] render", {
    timespansCount: timespans.length,
    hasOnUpdate: !!onUpdate,
    hasOnAdjust: !!onAdjust,
  });
  const [opened, { toggle }] = useDisclosure(!initiallyCollapsed);

  if (timespans.length === 0) {
    return null;
  }

  // Parse timestamps as UTC to avoid timezone shifts
  const totalHours = timespans.reduce((total, span) => {
    const start = parseUTCDate(span.start_timestamp).getTime();
    const end = span.end_timestamp
      ? parseUTCDate(span.end_timestamp).getTime()
      : Date.now();
    return total + (end - start) / (1000 * 60 * 60);
  }, 0);

  return (
    <Box p="sm" style={{ backgroundColor: "var(--mantine-color-gray-0)", borderRadius: "var(--mantine-radius-sm)", border: "1px solid var(--mantine-color-gray-3)" }}>
      <Group justify="space-between" style={{ cursor: "pointer" }} onClick={toggle}>
        <Text size="sm" fw={500}>
          {timespans.length} session{timespans.length !== 1 ? "s" : ""},{" "}
          {totalHours.toFixed(2)}h total
        </Text>
        <Text size="xs" c="dimmed">{opened ? "▲" : "▼"}</Text>
      </Group>
      <Collapse in={opened}>
        <Stack gap="sm" mt="sm">
          {timespans.map((span, index) => (
            <TimeSpanSession
              key={`${span.id}-${span.start_timestamp}-${span.end_timestamp || 'running'}`}
              timespan={span}
              index={index}
              onUpdate={onUpdate}
              onAdjust={onAdjust}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
