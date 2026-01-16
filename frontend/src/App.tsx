import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createLog,
  deleteLog,
  fetchLogsByDate,
  updateLog,
} from "./api";
import DateNavigator from "./components/DateNavigator";
import DailySnapshot from "./components/DailySnapshot";
import LogEntryCard from "./components/LogEntryCard";
import LogEntryEditor from "./components/LogEntryEditor";
import type { LogEntry, LogEntryCreate } from "./types";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const queryClient = useQueryClient();

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
              />
            ) : (
              <LogEntryCard
                key={entry.id}
                entry={entry}
                onEdit={(log) => setEditingEntry(log)}
                onDelete={(id) => deleteMutation.mutate(id)}
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
