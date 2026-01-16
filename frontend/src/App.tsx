import { useEffect, useMemo, useState } from "react";
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
  updateTimeSpan,
} from "./api";
import DateNavigator from "./components/DateNavigator";
import DailySnapshot from "./components/DailySnapshot";
import LogEntryCard from "./components/LogEntryCard";
import LogEntryEditor from "./components/LogEntryEditor";
import type { LogEntry, LogEntryCreate, Timer, TimeSpan } from "./types";

function formatDate(value: Date): string {
  // Use local date to avoid UTC timezone issues
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  const updateTimeSpanMutation = useMutation<
    TimeSpan,
    Error,
    { timespanId: number; startTimestamp: string; endTimestamp?: string }
  >({
    mutationFn: ({ timespanId, startTimestamp, endTimestamp }) =>
      updateTimeSpan(timespanId, startTimestamp, endTimestamp),
    onMutate: async ({ timespanId, startTimestamp, endTimestamp }) => {
      console.log("[updateTimeSpanMutation] onMutate called", {
        timespanId,
        startTimestamp,
        endTimestamp,
      });
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["timespans"] });
      
      // Store the query key for use in onSuccess
      const queryKey: [string, string] = ["timespans", logs.map((e) => e.id).join(",")];
      console.log("[updateTimeSpanMutation] onMutate queryKey:", queryKey);
      
      // Snapshot previous value
      const previousTimespans = queryClient.getQueryData<Record<number, TimeSpan[]>>(queryKey);
      console.log("[updateTimeSpanMutation] onMutate previousTimespans:", previousTimespans);
      
      // Optimistically update the cache
      if (previousTimespans) {
        queryClient.setQueryData<Record<number, TimeSpan[]>>(
          queryKey,
          (old) => {
            if (!old) {
              console.log("[updateTimeSpanMutation] onMutate: old data is null/undefined");
              return old;
            }
            const updated = { ...old };
            Object.keys(updated).forEach((entryId) => {
              const entryIdNum = parseInt(entryId, 10);
              updated[entryIdNum] = updated[entryIdNum].map((span) =>
                span.id === timespanId
                  ? {
                      ...span,
                      start_timestamp: startTimestamp,
                      end_timestamp: endTimestamp || span.end_timestamp,
                    }
                  : span
              );
            });
            console.log("[updateTimeSpanMutation] onMutate: optimistic update", {
              queryKey,
              updated,
              timespanId,
            });
            return updated;
          }
        );
      } else {
        console.log("[updateTimeSpanMutation] onMutate: no previousTimespans found");
      }
      
      return { previousTimespans, queryKey };
    },
    onError: (err, _variables, context) => {
      console.log("[updateTimeSpanMutation] onError called", { err, context });
      // Rollback on error
      if (context && typeof context === 'object' && 'previousTimespans' in context && 'queryKey' in context) {
        const ctx = context as { previousTimespans: Record<number, TimeSpan[]> | undefined; queryKey: [string, string] };
        queryClient.setQueryData(ctx.queryKey, ctx.previousTimespans);
      }
    },
    onSuccess: (data, variables, context) => {
      console.log("[updateTimeSpanMutation] onSuccess called", {
        data,
        variables,
        context,
      });
      
      // Helper function to update a query's cache
      const updateQueryCache = (queryKey: [string, string]) => {
        console.log("[updateTimeSpanMutation] onSuccess: updateQueryCache called", { queryKey });
        queryClient.setQueryData<Record<number, TimeSpan[]>>(
          queryKey,
          (old) => {
            if (!old) {
              console.log("[updateTimeSpanMutation] onSuccess: old data is null/undefined for", queryKey);
              return old;
            }
            const updated = { ...old };
            Object.keys(updated).forEach((entryId) => {
              const entryIdNum = parseInt(entryId, 10);
              const oldArray = updated[entryIdNum];
              updated[entryIdNum] = updated[entryIdNum].map((span) =>
                span.id === variables.timespanId ? data : span
              );
              const foundSpan = updated[entryIdNum].find((span) => span.id === variables.timespanId);
              if (foundSpan && oldArray.find((span) => span.id === variables.timespanId)) {
                console.log("[updateTimeSpanMutation] onSuccess: updated timespan in entry", {
                  entryId: entryIdNum,
                  oldSpan: oldArray.find((span) => span.id === variables.timespanId),
                  newSpan: foundSpan,
                });
              }
            });
            console.log("[updateTimeSpanMutation] onSuccess: cache updated", {
              queryKey,
              updated,
            });
            return updated;
          }
        );
        
        // Verify the update was applied
        const updatedData = queryClient.getQueryData<Record<number, TimeSpan[]>>(queryKey);
        console.log("[updateTimeSpanMutation] onSuccess: verified cache after update", {
          queryKey,
          updatedData,
        });
      };
      
      // First, update the query from onMutate context (the one we optimistically updated)
      if (context) {
        const ctx = context as { queryKey?: [string, string]; previousTimespans?: Record<number, TimeSpan[]> };
        if (ctx.queryKey) {
          console.log("[updateTimeSpanMutation] onSuccess: updating context queryKey", ctx.queryKey);
          updateQueryCache(ctx.queryKey);
        } else {
          console.log("[updateTimeSpanMutation] onSuccess: no context.queryKey found");
        }
      } else {
        console.log("[updateTimeSpanMutation] onSuccess: no context found");
      }
      
      // Also update any other matching queries (in case query key changed between onMutate and onSuccess)
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({ 
        queryKey: ["timespans"],
        exact: false 
      });
      console.log("[updateTimeSpanMutation] onSuccess: found matching queries", {
        count: matchingQueries.length,
        queryKeys: matchingQueries.map((q) => q.queryKey),
      });
      
      matchingQueries.forEach((query) => {
        const queryData = query.state.data as Record<number, TimeSpan[]> | undefined;
        if (queryData) {
          // Check if this query contains the timespan we're updating
          const containsTimespan = Object.values(queryData).some((spans) =>
            spans.some((span) => span.id === variables.timespanId)
          );
          if (containsTimespan) {
            console.log("[updateTimeSpanMutation] onSuccess: updating matching query", {
              queryKey: query.queryKey,
              containsTimespan,
            });
            updateQueryCache(query.queryKey as [string, string]);
          }
        }
      });
      
      // Only invalidate logs query to get updated hours (don't invalidate timespans since we updated it directly)
      console.log("[updateTimeSpanMutation] onSuccess: invalidating logs query", { dateString });
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
  
  // Log timespans query changes
  useEffect(() => {
    console.log("[App] timespansQueries.data changed", {
      timespansMap,
      queryKey: ["timespans", logs.map((e) => e.id).join(",")],
      isLoading: timespansQueries.isLoading,
      isFetching: timespansQueries.isFetching,
    });
  }, [timespansQueries.data, timespansQueries.isLoading, timespansQueries.isFetching]);

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
                onTimeSpanUpdate={(timespanId, startTimestamp, endTimestamp) => {
                  console.log("[App] onTimeSpanUpdate called", {
                    timespanId,
                    startTimestamp,
                    endTimestamp,
                  });
                  updateTimeSpanMutation.mutate({ timespanId, startTimestamp, endTimestamp });
                }}
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
                onTimeSpanAdjust={(timespanId, hours) =>
                  adjustTimeSpanMutation.mutate({ timespanId, hours })
                }
                onTimeSpanUpdate={(timespanId, startTimestamp, endTimestamp) => {
                  console.log("[App] onTimeSpanUpdate called from LogEntryCard", {
                    timespanId,
                    startTimestamp,
                    endTimestamp,
                  });
                  updateTimeSpanMutation.mutate({ timespanId, startTimestamp, endTimestamp });
                }}
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
