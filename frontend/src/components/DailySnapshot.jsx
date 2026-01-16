import React from "react";

const CATEGORY_COLORS = {
  "Routine Work": "#6c8cff",
  OKR: "#ff8c5a",
  "Team Contribution": "#4fc37d",
  "Company Contribution": "#d18cff",
};

function statusColor(totalHours) {
  if (totalHours >= 7) {
    return "status-good";
  }
  if (totalHours < 4) {
    return "status-warn";
  }
  return "status-neutral";
}

export default function DailySnapshot({ totalHours, categoryHours }) {
  const total = Object.values(categoryHours).reduce((sum, value) => sum + value, 0);
  return (
    <section className="snapshot">
      <div className="snapshot-block">
        <div className="snapshot-label">Total Hours Logged</div>
        <div className="snapshot-value">{totalHours.toFixed(1)}h</div>
      </div>
      <div className="snapshot-block">
        <div className="snapshot-label">Status Check</div>
        <div className={`status-pill ${statusColor(totalHours)}`}>
          {totalHours >= 7 ? "On Track" : totalHours < 4 ? "At Risk" : "Moderate"}
        </div>
      </div>
      <div className="snapshot-block snapshot-bar">
        <div className="snapshot-label">Category Distribution</div>
        <div className="distribution-bar">
          {Object.entries(categoryHours).map(([category, hours]) => {
            const ratio = total === 0 ? 0 : (hours / total) * 100;
            return (
              <span
                key={category}
                style={{
                  width: `${ratio}%`,
                  background: CATEGORY_COLORS[category] || "#999",
                }}
                title={`${category}: ${hours.toFixed(1)}h`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
