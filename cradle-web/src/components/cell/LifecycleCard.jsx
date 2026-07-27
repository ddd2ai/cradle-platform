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
            {lifecycle.phase ?? "--"}
          </div>

          <div className="lifecycle-metrics">
            <LifecycleMetric
              label="Health"
              value={lifecycle.health ?? "Unknown"}
            />
            <LifecycleMetric
              label="Next Evolution"
              value={lifecycle.nextEvolution ?? "--"}
            />
            <LifecycleMetric
              label="Convergence"
              value={lifecycle.convergence ?? "--"}
            />
            <LifecycleMetric
              label="Failure Rate"
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
