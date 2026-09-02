import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

/**
 * @param {{
 *   lifecycle?: object | null;
 *   isLoading?: boolean;
 *   error?: string | null;
 * }} props
 */
export function LifecycleCard({
  lifecycle = null,
  isLoading = false,
  error = null,
}) {
  const { t } = useUiPreferences();
  return (
    <article className="dashboard-card lifecycle-card">
      <div className="dashboard-card-label">{t("cell.lifecycle")}</div>

      {isLoading && (
        <div className="lifecycle-state-message">{t("cell.lifecycleLoading")}</div>
      )}

      {!isLoading && error && (
        <div className="lifecycle-state-message is-error">
          {t("cell.lifecycleError")}
        </div>
      )}

      {!isLoading && !error && !lifecycle && (
        <div className="lifecycle-state-message">
          {t("cell.lifecycleEmpty")}
        </div>
      )}

      {!isLoading && !error && lifecycle && (
        <>
          <div className="lifecycle-status">
            {lifecycle.phase ?? "--"}
          </div>

          <div className="lifecycle-metrics">
            <LifecycleMetric
              label={t("cell.health")}
              value={lifecycle.health ?? t("status.unknown")}
            />
            <LifecycleMetric
              label={t("cell.nextEvolution")}
              value={lifecycle.nextEvolution ?? "--"}
            />
            <LifecycleMetric
              label={t("cell.convergence")}
              value={lifecycle.convergence ?? "--"}
            />
            <LifecycleMetric
              label={t("cell.failureRate")}
              value={formatFailureRate(lifecycle.failureRate)}
            />
          </div>
        </>
      )}
    </article>
  );
}

function formatFailureRate(value) {
  return Number.isFinite(value) ? `${value}%` : "--";
}

function LifecycleMetric({ label, value }) {
  return (
    <div className="lifecycle-metric-row">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}
