import React from "react";
import { Group, Button } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { DateNavigatorProps } from "../types";

export default function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const handlePrev = () => {
    const next = new Date(date);
    next.setDate(next.getDate() - 1);
    onChange(next);
  };

  const handleNext = () => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    onChange(next);
  };

  return (
    <Group justify="space-between" p="md" style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "var(--mantine-color-body)" }}>
      <Button variant="subtle" onClick={handlePrev}>
        &lt; Previous Day
      </Button>
      <DateInput
        value={date}
        onChange={(value) => value && onChange(value)}
      />
      <Button variant="subtle" onClick={handleNext}>
        Next Day &gt;
      </Button>
    </Group>
  );
}
