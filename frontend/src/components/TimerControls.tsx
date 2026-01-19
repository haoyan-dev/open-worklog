import React from "react";
import { ActionIcon, Badge, Group, Text, Tooltip } from "@mantine/core";
import { IconPlayerPause, IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { useTimer } from "../hooks/useTimer";
import type { TimeSpan } from "../types";

interface TimerControlsProps {
  activeTimeSpan: TimeSpan | null;
  entryId: number;
  timespans?: TimeSpan[];
  disabled?: boolean;
  mode?: "status" | "actions" | "both";
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

export default function TimerControls({
  activeTimeSpan,
  entryId,
  timespans = [],
  disabled = false,
  mode = "both",
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
  const canStart = !isActiveForThisEntry;

  return (
    <Group gap="sm" align="center">
      {(mode === "status" || mode === "both") && isActiveForThisEntry && (
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
          <Text fw={600} size="sm" style={{ fontFamily: "monospace" }}>
            {formattedTime}
          </Text>
        </Group>
      )}
      {(mode === "actions" || mode === "both") && (
        <Group gap={6}>
          {canStart && (
            <Tooltip label="Start timer" withArrow>
              <ActionIcon
                variant="light"
                color="green"
                onClick={onStart}
                disabled={disabled}
                aria-label="Start timer"
              >
                <IconPlayerPlay size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canPause && (
            <Tooltip label="Pause timer" withArrow>
              <ActionIcon
                variant="light"
                color="orange"
                onClick={onPause}
                aria-label="Pause timer"
              >
                <IconPlayerPause size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canStop && (
            <Tooltip label="Stop timer" withArrow>
              <ActionIcon
                variant="light"
                color="red"
                onClick={onStop}
                aria-label="Stop timer"
              >
                <IconPlayerStop size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      )}
    </Group>
  );
}
