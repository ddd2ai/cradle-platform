/**
 * @param {{
 *   maturity?: object | null;
 *   isLoading?: boolean;
 *   error?: string | null;
 * }} props
 */
export function MaturityCard({
  maturity = null,
  isLoading = false,
  error = null,
}) {
  return (
    <article className="dashboard-card maturity-card">
      <div className="dashboard-card-label">Maturity</div>

      {isLoading && (
        <div className="maturity-state-message">Loading maturity...</div>
      )}

      {!isLoading && error && (
        <div className="maturity-state-message is-error">
          Unable to load maturity information.
        </div>
      )}

      {!isLoading && !error && !maturity && (
        <div className="maturity-state-message">
          No maturity information available.
        </div>
      )}

      {!isLoading && !error && maturity && (
        <>
          <div className="maturity-summary">
            <strong className="maturity-value">
              {formatPercent(maturity.value ?? maturity.maturity)}
            </strong>
            <span className="maturity-badge">
              {String(maturity.state ?? "unknown").toUpperCase()}
            </span>
          </div>

          <p className="maturity-description">
            Estimated maturity of the selected cell.
          </p>

          <div className="maturity-metrics">
            <MaturityMetric
              label="Normalized Magnitude"
              value={formatDecimal(maturity.normalizedMagnitude, 3)}
            />
            <MaturityMetric
              label="Temporal Variance"
              value={formatDecimal(maturity.temporalVariance, 4)}
            />
            <MaturityMetric
              label="Convergence"
              value={formatDecimal(maturity.convergence, 4)}
            />
            <MaturityMetric
              label="Sample Size"
              value={formatInteger(maturity.sampleSize)}
            />
            <MaturityMetric
              label="Dominant Trait"
              value={maturity.dominantTrait ?? "—"}
            />
          </div>
        </>
      )}
    </article>
  );
}

function MaturityMetric({ label, value }) {
  return (
    <div className="maturity-metric-row">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function formatPercent(value) {
  if (typeof value !== "number") {
    return "—";
  }

  const normalized = value <= 1 ? value * 100 : value;
  const percent = Math.max(0, Math.min(100, normalized));
  return `${Math.round(percent)}%`;
}

function formatDecimal(value, digits) {
  if (typeof value !== "number") {
    return "—";
  }

  return value.toFixed(digits);
}

function formatInteger(value) {
  if (typeof value !== "number") {
    return "—";
  }

  return String(Math.round(value));
}
