import React from "react";
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
    <div className="timespan-session-adjust">
      <div className="timespan-session-adjust-buttons">
        {[0.25, 0.5, 1].map((hours) => (
          <React.Fragment key={hours}>
            <button
              type="button"
              className="timespan-session-adjust-btn add"
              onClick={(e) => {
                e.stopPropagation();
                onAdjust(timespanId, hours);
              }}
              title={`Add ${hours}h`}
            >
              +{hours}h
            </button>
            {duration > hours && (
              <button
                type="button"
                className="timespan-session-adjust-btn subtract"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjust(timespanId, -hours);
                }}
                title={`Subtract ${hours}h`}
              >
                -{hours}h
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
