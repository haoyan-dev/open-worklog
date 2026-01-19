import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accordion, Alert, Button, Container, Divider, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";

import { fetchStats } from "../api";
import DailySnapshot from "../components/DailySnapshot";
import type { DailyStat } from "../types";

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(value: Date): Date {
  const start = new Date(value);
  const dayIndex = start.getDay();
  const offset = (dayIndex + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function buildEmptyStat(date: string): DailyStat {
  return { date, total_hours: 0, category_hours: {} };
}

function getCalendarDayProps(day: Date | string) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/9d07a6cc-c2b9-4935-9ed7-510d027f6df0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'WeekView.tsx:getCalendarDayProps', message: 'getDayProps entry', data: { type: typeof day, isDate: day instanceof Date, hasGetDay: typeof (day as Date | undefined)?.getDay === 'function', value: String(day) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H1' }) }).catch(() => { });
  // #endregion
  const isDate = day instanceof Date;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/9d07a6cc-c2b9-4935-9ed7-510d027f6df0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'WeekView.tsx:getCalendarDayProps', message: 'date type check', data: { isDate }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H2' }) }).catch(() => { });
  // #endregion
  let resolved = day;
  if (!isDate && typeof day === "string") {
    const [y, m, d] = day.split("-").map((value) => Number(value));
    if (y && m && d) {
      resolved = new Date(y, m - 1, d);
    }
  }
  const resolvedIsDate = resolved instanceof Date && !Number.isNaN(resolved.getTime());
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/9d07a6cc-c2b9-4935-9ed7-510d027f6df0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'WeekView.tsx:getCalendarDayProps', message: 'resolved day', data: { resolvedIsDate, originalType: typeof day, resolvedType: typeof resolved }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H3' }) }).catch(() => { });
  // #endregion
  if (!resolvedIsDate) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d07a6cc-c2b9-4935-9ed7-510d027f6df0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'WeekView.tsx:getCalendarDayProps', message: 'unusable day value', data: { type: typeof day, constructor: (day as { constructor?: { name?: string } } | undefined)?.constructor?.name, value: String(day) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H4' }) }).catch(() => { });
    // #endregion
    return {};
  }
  const dow = resolved.getDay(); // 0 = Sunday, 6 = Saturday
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/9d07a6cc-c2b9-4935-9ed7-510d027f6df0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'WeekView.tsx:getCalendarDayProps', message: 'computed dow', data: { dow }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H4' }) }).catch(() => { });
  // #endregion
  if (dow === 0) {
    return { style: { color: "var(--mantine-color-red-7)", fontWeight: 600 } };
  }
  if (dow === 6) {
    return { style: { color: "var(--mantine-color-blue-7)", fontWeight: 600 } };
  }
  return {};
}

export default function WeekView() {
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const startDateString = formatDate(weekStart);
  const endDateString = formatDate(weekEnd);

  const { data: stats = [], isLoading, isError, error } = useQuery<DailyStat[]>({
    queryKey: ["stats", startDateString, endDateString],
    queryFn: () => fetchStats(startDateString, endDateString),
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const statsByDate = useMemo(() => {
    const map = new Map<string, DailyStat>();
    stats.forEach((stat) => {
      map.set(stat.date, stat);
    });
    return map;
  }, [stats]);

  const normalizedStats = useMemo(
    () =>
      weekDays.map((date) => {
        const key = formatDate(date);
        return statsByDate.get(key) ?? buildEmptyStat(key);
      }),
    [statsByDate, weekDays]
  );

  const weeklySummary = useMemo(() => {
    const categoryHours: Record<string, number> = {};
    let totalHours = 0;
    normalizedStats.forEach((stat) => {
      totalHours += stat.total_hours;
      Object.entries(stat.category_hours).forEach(([category, hours]) => {
        categoryHours[category] = (categoryHours[category] || 0) + hours;
      });
    });
    return { totalHours, categoryHours };
  }, [normalizedStats]);

  const rangeLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
  }, [weekStart, weekEnd]);

  const dayLabel = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(date);

  const dayTextColor = (date: Date) => {
    const dow = date.getDay();
    if (dow === 0) return "red.7";
    if (dow === 6) return "blue.7";
    return undefined;
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap={6}>
          <Title order={2}>Week View</Title>
          <Text size="sm" c="dimmed">
            {rangeLabel}
          </Text>
        </Stack>

        <Group justify="space-between" align="flex-end">
          <Group>
            <Button
              variant="default"
              onClick={() => setAnchorDate((prev) => addDays(prev, -7))}
            >
              Previous Week
            </Button>
            <Button
              variant="default"
              onClick={() => setAnchorDate((prev) => addDays(prev, 7))}
            >
              Next Week
            </Button>
          </Group>
          <DateInput
            value={anchorDate}
            onChange={(value) => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/9d07a6cc-c2b9-4935-9ed7-510d027f6df0', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'WeekView.tsx:DateInput.onChange', message: 'date input change', data: { type: typeof value, isDate: value instanceof Date, value: String(value) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H5' }) }).catch(() => { });
              // #endregion
              if (value) setAnchorDate(value as Date);
            }}
            valueFormat="YYYY-MM-DD"
            label="Week of"
            placeholder="Select date"
            getDayProps={getCalendarDayProps}
          />
        </Group>

        {isLoading ? <Loader /> : null}
        {isError ? (
          <Alert color="red" title="Error">
            {error instanceof Error ? error.message : "Failed to load week stats."}
          </Alert>
        ) : null}

        {!isLoading && !isError ? (
          <Stack gap="lg">
            <DailySnapshot
              totalHours={weeklySummary.totalHours}
              categoryHours={weeklySummary.categoryHours}
            />

            <Stack gap="sm">
              <Divider label="Workdays" labelPosition="center" my="sm" />
              <Accordion multiple={false} variant="contained">
                {weekDays.map((day, index) => {
                  const stat = normalizedStats[index];
                  const label = dayLabel(day);
                  const hoursLabel = `${stat.total_hours.toFixed(1)}h`;
                  const color = dayTextColor(day);
                  return (
                    <>
                      {day.getDay() === 6 ? (
                        <Divider
                          key={`${stat.date}-divider`}
                          label="Weekend"
                          labelPosition="center"
                          my="sm"
                        />
                      ) : null}
                      <Accordion.Item key={stat.date} value={stat.date}>
                        <Accordion.Control>
                          <Group justify="space-between" wrap="nowrap">
                            <Text fw={600} c={color}>
                              {label}
                            </Text>
                            <Text c={color}>{hoursLabel}</Text>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <DailySnapshot
                            totalHours={stat.total_hours}
                            categoryHours={stat.category_hours}
                          />
                        </Accordion.Panel>
                      </Accordion.Item>
                    </>
                  );
                })}
              </Accordion>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
