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
  const decision = lifecycle?.decision ?? null;

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
            {String(lifecycle.status ?? "unknown").toLowerCase()}
          </div>

          <p className="lifecycle-description">
            Current software life-cycle state.
          </p>

          <div className="lifecycle-metrics">
            <LifecycleMetric
              label="Recommended Action"
              value={formatAction(decision?.action)}
            />
            <LifecycleMetric
              label="Decision Reason"
              value={formatDecisionReason(decision?.reason)}
            />
            <LifecycleMetric
              label="Cross-Trait Variance"
              value={formatDecimal(decision?.crossTraitVariance, 4)}
            />
            <LifecycleMetric
              label="Recent Failure Rate"
              value={formatPercent(decision?.recentFailureRate)}
            />
            <LifecycleMetric
              label="Complementary Cell"
              value={decision?.complementaryCellId ?? "None"}
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

function formatAction(action) {
  if (!action) {
    return "—";
  }

  return String(action).toUpperCase();
}

function formatDecisionReason(reason) {
  const labels = {
    insufficient_samples: "Insufficient samples",
    high_temporal_variance: "High temporal variance",
    high_failure_rate: "High recent failure rate",
    maturity_below_threshold: "Maturity below threshold",
    stable_specialization: "Stable specialization",
    stable_generalization_with_complement:
      "Stable generalization with complement",
    normal_growth: "Normal growth",
  };

  if (!reason) {
    return "—";
  }

  return labels[reason] ?? String(reason).replaceAll("_", " ");
}

function formatDecimal(value, digits) {
  if (typeof value !== "number") {
    return "—";
  }

  return value.toFixed(digits);
}

function formatPercent(value) {
  if (typeof value !== "number") {
    return "—";
  }

  const normalized = value <= 1 ? value * 100 : value;
  const percent = Math.max(0, Math.min(100, normalized));
  return `${Math.round(percent)}%`;
}
