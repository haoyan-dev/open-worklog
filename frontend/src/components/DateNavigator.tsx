import React from "react";
import type { DateNavigatorProps } from "../types";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const handlePrev = () => {
    const next = new Date(date);
    next.setDate(next.getDate() - 1);
    onChange(next);
  };

  const handleNext = () => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    onChange(next);
  };

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(new Date(event.target.value));
  };

  return (
    <header className="date-nav">
      <button className="ghost-button" onClick={handlePrev}>
        &lt; Previous Day
      </button>
      <input
        className="date-input"
        type="date"
        value={formatDate(date)}
        onChange={handleInput}
      />
      <button className="ghost-button" onClick={handleNext}>
        Next Day &gt;
      </button>
    </header>
  );
}
