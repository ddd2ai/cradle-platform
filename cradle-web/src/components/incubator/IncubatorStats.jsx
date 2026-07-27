export function IncubatorStats({ summary }) {
  const stats = [
    { value: formatCount(summary?.totalCells), label: "Total Cells" },
    { value: formatCount(summary?.activeCells), label: "Active Cells" },
    { value: formatCount(summary?.idleCells), label: "Idle Cells" },
    {
      value: summary?.averageMaturityLabel ?? "--",
      label: "Average Maturity",
    },
  ];

  return (
    <dl className="incubator-stats" aria-label="Incubator summary">
      {stats.map((stat) => (
        <div key={stat.label} className="incubator-stat">
          <dd>{stat.value}</dd>
          <dt>{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function formatCount(value) {
  return Number.isFinite(value) ? value : "--";
}
