import React from "react";
import { Group, Button } from "@mantine/core";
import { getHoursFromMidnight } from "../utils/timeUtils";

interface TimeSpanAdjustButtonsProps {
  timespanId: number;
  startTime: Date;
  endTime: Date;
  onAdjust: (timespanId: number, hours: number) => void;
}

export default function TimeSpanAdjustButtons({
  timespanId,
  startTime,
  endTime,
  onAdjust,
}: TimeSpanAdjustButtonsProps) {
  const startHours = getHoursFromMidnight(startTime);
  const endHours = getHoursFromMidnight(endTime);
  const duration = endHours - startHours;

  return (
    <Group gap="xs" mt="xs">
      {[0.25, 0.5, 1].map((hours) => (
        <React.Fragment key={hours}>
          <Button
            size="xs"
            color="green"
            variant="light"
            onClick={(e) => {
              e.stopPropagation();
              onAdjust(timespanId, hours);
            }}
            title={`Add ${hours}h`}
          >
            +{hours}h
          </Button>
          {duration > hours && (
            <Button
              size="xs"
              color="orange"
              variant="light"
              onClick={(e) => {
                e.stopPropagation();
                onAdjust(timespanId, -hours);
              }}
              title={`Subtract ${hours}h`}
            >
              -{hours}h
            </Button>
          )}
        </React.Fragment>
      ))}
    </Group>
  );
}
