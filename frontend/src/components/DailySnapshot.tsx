import React from "react";
import { Card, Group, Stack, Text, Badge, Progress } from "@mantine/core";
import type { DailySnapshotProps } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  "Routine Work": "blue",
  OKR: "orange",
  "Team Contribution": "green",
  "Company Contribution": "violet",
};

function getStatusColor(totalHours: number): string {
  if (totalHours >= 7) {
    return "green";
  }
  if (totalHours < 4) {
    return "orange";
  }
  return "blue";
}

function getStatusLabel(totalHours: number): string {
  if (totalHours >= 7) {
    return "On Track";
  }
  if (totalHours < 4) {
    return "At Risk";
  }
  return "Moderate";
}

export default function DailySnapshot({
  totalHours,
  categoryHours,
}: DailySnapshotProps) {
  const ROW_HEIGHT = 60;
  const total = Object.values(categoryHours).reduce(
    (sum, value) => sum + value,
    0
  );
  
  const segments = Object.entries(categoryHours).map(([category, hours]) => ({
    value: total === 0 ? 0 : (hours / total) * 100,
    color: CATEGORY_COLORS[category] || "gray",
    label: `${category}: ${hours.toFixed(1)}h`,
  }));

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" gap="md" align="stretch">
        <Stack
          gap={4}
          style={{ height: ROW_HEIGHT, justifyContent: "center" }}
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Total Hours Logged
          </Text>
          <Text size="xl" fw={600}>
            {totalHours.toFixed(1)}h
          </Text>
        </Stack>
        <Stack
          gap={4}
          style={{ height: ROW_HEIGHT, justifyContent: "center" }}
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Status Check
          </Text>
          <Badge color={getStatusColor(totalHours)} size="lg">
            {getStatusLabel(totalHours)}
          </Badge>
        </Stack>
        <Stack
          gap={4}
          style={{ flex: 1, minWidth: 200, height: ROW_HEIGHT, justifyContent: "center" }}
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Category Distribution
          </Text>
          <Progress.Root size="md" style={{ width: "100%" }}>
            {segments.map((segment, index) => (
              <Progress.Section
                key={index}
                value={segment.value}
                color={segment.color}
                title={segment.label}
              />
            ))}
          </Progress.Root>
        </Stack>
      </Group>
    </Card>
  );
}
