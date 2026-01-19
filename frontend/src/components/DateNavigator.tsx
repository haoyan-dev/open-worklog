import React, { useMemo } from "react";
import { Group } from "@mantine/core";
import { MiniCalendar } from "@mantine/dates";
import dayjs from "dayjs";
import type { DateNavigatorProps } from "../types";

export default function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const value = useMemo(() => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [date]);

  return (
    <Group
      justify="center"
      p="md"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        backgroundColor: "var(--mantine-color-body)",
        width: "100%",
      }}
    >
      <MiniCalendar
        value={value}
        onChange={(next) => {
          if (!next) return;
          // next is YYYY-MM-DD; construct a local Date (avoid UTC shifting)
          const [y, m, d] = next.split("-").map((v) => Number(v));
          if (!y || !m || !d) return;
          onChange(new Date(y, m - 1, d));
        }}
        numberOfDays={7}
        getDayProps={(day) => {
          const dow = dayjs(day).day(); // 0 = Sunday, 6 = Saturday
          if (dow === 0) {
            return { style: { color: "var(--mantine-color-red-7)", fontWeight: 600 } };
          }
          if (dow === 6) {
            return { style: { color: "var(--mantine-color-blue-7)", fontWeight: 600 } };
          }
          return {};
        }}
      />
    </Group>
  );
}
