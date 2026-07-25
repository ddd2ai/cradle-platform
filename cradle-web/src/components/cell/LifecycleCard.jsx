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
  return (
    <article className="dashboard-card lifecycle-card">
      <div className="dashboard-card-label">Lifecycle</div>

      {isLoading && (
        <div className="lifecycle-state-message">Loading lifecycle...</div>
      )}

      {!isLoading && error && (
        <div className="lifecycle-state-message is-error">
          Unable to load lifecycle information.
        </div>
      )}

      {!isLoading && !error && !lifecycle && (
        <div className="lifecycle-state-message">
          No lifecycle information available.
        </div>
      )}

      {!isLoading && !error && lifecycle && (
        <>
          <div className="lifecycle-status">
            {lifecycle.phase ?? "—"}
          </div>

          <div className="lifecycle-metrics">
            <LifecycleMetric
              label="Health"
              value={lifecycle.health ?? "—"}
            />
            <LifecycleMetric
              label="Next Evolution"
              value={lifecycle.nextEvolution ?? "—"}
            />
            <LifecycleMetric
              label="Convergence"
              value={lifecycle.convergence ?? "—"}
            />
            <LifecycleMetric
              label="Failure Rate"
              value={`${lifecycle.failureRate ?? 0}%`}
            />
          </div>
        </>
      )}
    </article>
  );
}

function LifecycleMetric({ label, value }) {
  return (
    <div className="lifecycle-metric-row">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}
