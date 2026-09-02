import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function IncubatorStats({ summary }) {
  const { t } = useUiPreferences();
  const stats = [
    { value: formatCount(summary?.totalCells), label: t("incubator.totalCells") },
    { value: formatCount(summary?.activeCells), label: t("incubator.activeCells") },
    { value: formatCount(summary?.idleCells), label: t("incubator.idleCells") },
    {
      value: summary?.averageMaturityLabel ?? "--",
      label: t("incubator.averageMaturity"),
    },
  ];

  return (
    <dl className="incubator-stats" aria-label={t("incubator.summary")}>
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
