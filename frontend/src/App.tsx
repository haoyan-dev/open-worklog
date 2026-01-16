import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createLog,
  deleteLog,
  fetchLogsByDate,
  updateLog,
  getActiveTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimeSpans,
  adjustTimeSpan,
} from "./api";
import DateNavigator from "./components/DateNavigator";
import DailySnapshot from "./components/DailySnapshot";
import LogEntryCard from "./components/LogEntryCard";
import LogEntryEditor from "./components/LogEntryEditor";
import type { LogEntry, LogEntryCreate, Timer, TimeSpan } from "./types";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const queryClient = useQueryClient();
  
  // Timer state management
  const {
    data: activeTimer,
    isLoading: timerLoading,
  } = useQuery<Timer | null>({
    queryKey: ["activeTimer"],
    queryFn: getActiveTimer,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const dateString = formatDate(selectedDate);
  const {
    data: logs = [],
    isLoading,
    isError,
    error,
  } = useQuery<LogEntry[]>({
    queryKey: ["logs", dateString],
    queryFn: () => fetchLogsByDate(dateString),
  });

  const createMutation = useMutation<LogEntry, Error, LogEntryCreate>({
    mutationFn: createLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation<
    LogEntry,
    Error,
    { id: number; payload: LogEntryCreate }
  >({
    mutationFn: ({ id, payload }) => updateLog(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
      setEditingEntry(null);
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: deleteLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
    },
  });

  // Timer mutations
  const startTimerMutation = useMutation<Timer, Error, { entryId: number }>({
    mutationFn: ({ entryId }) => startTimer({ log_entry_id: entryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTimer"] });
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
    },
  });

  const pauseTimerMutation = useMutation<Timer, Error, number>({
    mutationFn: pauseTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTimer"] });
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
    },
  });

  const resumeTimerMutation = useMutation<Timer, Error, number>({
    mutationFn: resumeTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTimer"] });
    },
  });

  const stopTimerMutation = useMutation<LogEntry, Error, number>({
    mutationFn: stopTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTimer"] });
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
    },
  });

  const adjustTimeSpanMutation = useMutation<
    TimeSpan,
    Error,
    { timespanId: number; hours: number }
  >({
    mutationFn: ({ timespanId, hours }) => adjustTimeSpan(timespanId, hours),
    onSuccess: () => {
      // Invalidate timespans query to refresh the list
      queryClient.invalidateQueries({ 
        queryKey: ["timespans"],
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: ["logs", dateString] });
    },
  });

  // Fetch timespans for each entry
  const timespansQueries = useQuery<Record<number, TimeSpan[]>>({
    queryKey: ["timespans", logs.map((e) => e.id).join(",")],
    queryFn: async () => {
      const timespansMap: Record<number, TimeSpan[]> = {};
      await Promise.all(
        logs.map(async (entry) => {
          try {
            const spans = await getTimeSpans(entry.id);
            timespansMap[entry.id] = spans;
          } catch (error) {
            timespansMap[entry.id] = [];
          }
        })
      );
      return timespansMap;
    },
    enabled: logs.length > 0,
  });

  const timespansMap = timespansQueries.data || {};

  const summary = useMemo(() => {
    const categoryHours: Record<string, number> = {};
    let totalHours = 0;
    logs.forEach((entry) => {
      totalHours += entry.hours;
      categoryHours[entry.category] =
        (categoryHours[entry.category] || 0) + entry.hours;
    });
    return { totalHours, categoryHours };
  }, [logs]);

  const handleSave = (payload: LogEntryCreate) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="app">
      <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      <main className="content">
        <DailySnapshot
          totalHours={summary.totalHours}
          categoryHours={summary.categoryHours}
        />
        {isCreating ? (
          <LogEntryEditor
            date={dateString}
            onSave={handleSave}
            onCancel={() => setIsCreating(false)}
            timespans={[]}
          />
        ) : null}
        {isLoading ? <p>Loading logs...</p> : null}
        {isError ? <p className="error">{error?.message}</p> : null}
        <section className="log-list">
          {logs.map((entry) =>
            editingEntry && editingEntry.id === entry.id ? (
              <LogEntryEditor
                key={entry.id}
                entry={editingEntry}
                date={dateString}
                onSave={handleSave}
                onCancel={() => setEditingEntry(null)}
                timespans={timespansMap[editingEntry.id] || []}
                onTimeSpanAdjust={(timespanId, hours) =>
                  adjustTimeSpanMutation.mutate({ timespanId, hours })
                }
              />
            ) : (
              <LogEntryCard
                key={entry.id}
                entry={entry}
                onEdit={(log) => setEditingEntry(log)}
                onDelete={(id) => deleteMutation.mutate(id)}
                activeTimer={activeTimer}
                timespans={timespansMap[entry.id] || []}
                onStartTimer={(entryId) =>
                  startTimerMutation.mutate({ entryId })
                }
                onPauseTimer={(timerId) => pauseTimerMutation.mutate(timerId)}
                onResumeTimer={(timerId) =>
                  resumeTimerMutation.mutate(timerId)
                }
                onStopTimer={(timerId) => stopTimerMutation.mutate(timerId)}
              />
            )
          )}
        </section>
      </main>
      <button
        className="fab"
        onClick={() => {
          setEditingEntry(null);
          setIsCreating(true);
        }}
        aria-label="Add log entry"
      >
        +
      </button>
    </div>
  );
}
