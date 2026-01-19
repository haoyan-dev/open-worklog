import React from "react";
import { Group, Button, Text, Badge } from "@mantine/core";
import { useTimer } from "../hooks/useTimer";
import type { TimeSpan } from "../types";

interface TimerControlsProps {
  activeTimeSpan: TimeSpan | null;
  entryId: number;
  timespans?: TimeSpan[];
  disabled?: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

export default function TimerControls({
  activeTimeSpan,
  entryId,
  timespans = [],
  disabled = false,
  onStart,
  onPause,
  onStop,
}: TimerControlsProps) {
  const isActiveForThisEntry = activeTimeSpan?.log_entry_id === entryId;
  const { formattedTime, isRunning } = useTimer(
    isActiveForThisEntry ? activeTimeSpan : null,
    timespans
  );

  const canPause = isActiveForThisEntry && isRunning;
  const canStop = isActiveForThisEntry && isRunning;

  return (
    <Group gap="sm" align="center">
      {isActiveForThisEntry && (
        <Group gap="xs" align="center">
          <Badge
            color="green"
            variant="dot"
            size="lg"
            style={{
              animation: isRunning ? "pulse 2s ease-in-out infinite" : undefined,
            }}
          >
            Running
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
            disabled={disabled}
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
