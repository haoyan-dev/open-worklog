import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accordion, Alert, Button, Container, Divider, Group, Loader, Modal, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";

import { downloadWeeklyReport, fetchStats } from "../api";
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

function isDateValue(value: unknown): value is Date {
  return value instanceof Date;
}

function buildEmptyStat(date: string): DailyStat {
  return { date, total_hours: 0, category_hours: {} };
}

function getCalendarDayProps(day: Date | string) {
  const isDate = day instanceof Date;
  let resolved: Date | null = null;
  if (isDate) {
    resolved = day;
  } else if (typeof day === "string") {
    const [y, m, d] = day.split("-").map((value) => Number(value));
    if (y && m && d) {
      resolved = new Date(y, m - 1, d);
    }
  }
  const resolvedIsDate = resolved instanceof Date && !Number.isNaN(resolved.getTime());
  if (!resolvedIsDate) {
    return {};
  }
  const resolvedDate = resolved as Date;
  const dow = resolvedDate.getDay(); // 0 = Sunday, 6 = Saturday
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportAuthor, setExportAuthor] = useState("");
  const [exportSummaryQualitative, setExportSummaryQualitative] = useState("");
  const [exportSummaryQuantitative, setExportSummaryQuantitative] = useState("");
  const [exportNextWeekPlan, setExportNextWeekPlan] = useState("");

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
          <Button variant="default" onClick={() => setExportOpen(true)}>
            Download Weekly Report
          </Button>
          <DateInput
            value={anchorDate}
            onChange={(value) => {
              const isDate = isDateValue(value);
              if (isDate) setAnchorDate(value);
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
      <Modal
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Weekly Report Details"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Author"
            placeholder="Your name"
            value={exportAuthor}
            onChange={(event) => setExportAuthor(event.currentTarget.value)}
          />
          <Textarea
            label="Summary (qualitative)"
            placeholder="Highlights and insights"
            minRows={2}
            value={exportSummaryQualitative}
            onChange={(event) => setExportSummaryQualitative(event.currentTarget.value)}
          />
          <Textarea
            label="Summary (quantitative)"
            placeholder="Metrics and totals"
            minRows={2}
            value={exportSummaryQuantitative}
            onChange={(event) => setExportSummaryQuantitative(event.currentTarget.value)}
          />
          <Textarea
            label="Next week plan"
            placeholder="One item per line"
            minRows={3}
            value={exportNextWeekPlan}
            onChange={(event) => setExportNextWeekPlan(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setExportOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const nextWeekItems = exportNextWeekPlan
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean);
                downloadWeeklyReport({
                  weekStart: startDateString,
                  author: exportAuthor || undefined,
                  summaryQualitative: exportSummaryQualitative || undefined,
                  summaryQuantitative: exportSummaryQuantitative || undefined,
                  nextWeekPlan: nextWeekItems.length > 0 ? nextWeekItems : undefined,
                }).catch((error) => {
                  console.warn("[WeekView] Failed to download weekly report", error);
                });
                setExportOpen(false);
              }}
            >
              Download
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
