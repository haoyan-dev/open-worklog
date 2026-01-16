import React from "react";
import { Group, Button, Text, Badge } from "@mantine/core";
import type { Timer } from "../types";
import { useTimer } from "../hooks/useTimer";
import type { TimeSpan } from "../types";

interface TimerControlsProps {
  timer: Timer | null;
  entryId: number;
  timespans?: TimeSpan[];
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function TimerControls({
  timer,
  entryId,
  timespans = [],
  disabled = false,
  onStart,
  onPause,
  onResume,
  onStop,
}: TimerControlsProps) {
  const isActiveForThisEntry = timer?.log_entry_id === entryId;
  const { formattedTime, isRunning, isPaused } = useTimer(
    isActiveForThisEntry ? timer : null,
    timespans
  );

  const hasActiveTimer = timer !== null;
  const canStart = !hasActiveTimer || isActiveForThisEntry;
  const canPause = isActiveForThisEntry && isRunning;
  const canResume = isActiveForThisEntry && isPaused;
  const canStop = isActiveForThisEntry && (isRunning || isPaused);

  return (
    <Group gap="sm" align="center">
      {isActiveForThisEntry && (
        <Group gap="xs" align="center">
          <Badge
            color={isRunning ? "green" : "orange"}
            variant="dot"
            size="lg"
            style={{
              animation: isRunning ? "pulse 2s ease-in-out infinite" : undefined,
            }}
          >
            {isRunning ? "Running" : "Paused"}
          </Badge>
          <Text fw={600} size="sm">
            {formattedTime}
          </Text>
        </Group>
      )}
      <Group gap="xs">
        {!isActiveForThisEntry && (
          <Button
            size="xs"
            color="green"
            variant="light"
            onClick={onStart}
            disabled={disabled || !canStart}
          >
            Start
          </Button>
        )}
        {canPause && (
          <Button
            size="xs"
            color="orange"
            variant="light"
            onClick={onPause}
          >
            Pause
          </Button>
        )}
        {canResume && (
          <Button
            size="xs"
            color="blue"
            variant="light"
            onClick={onResume}
          >
            Resume
          </Button>
        )}
        {canStop && (
          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={onStop}
          >
            Stop
          </Button>
        )}
      </Group>
    </Group>
  );
}
