import { useMemo } from "react";
import { Group } from "@mantine/core";
import { MiniCalendar } from "@mantine/dates";
import dayjs from "dayjs";
import type { DateNavigatorProps } from "../types";

function formatIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStartMonday(value: Date): Date {
  const start = new Date(value);
  // JS: 0 = Sunday ... 6 = Saturday; convert to Monday-based week start
  const dayIndex = start.getDay();
  const offset = (dayIndex + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export default function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const selectedIso = useMemo(() => formatIsoDate(date), [date]);
  const weekStartIso = useMemo(
    () => formatIsoDate(getWeekStartMonday(date)),
    [date]
  );

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
        value={selectedIso}
        // Per docs, defaultDate controls the start of the visible range even when value is set:
        // https://mantine.dev/dates/mini-calendar/
        defaultDate={weekStartIso}
        numberOfDays={7}
        onChange={(next) => {
          if (!next) return;
          // next is YYYY-MM-DD; construct a local Date (avoid UTC shifting)
          const [y, m, d] = next.split("-").map((v) => Number(v));
          if (!y || !m || !d) return;
          onChange(new Date(y, m - 1, d));
        }}
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
