import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

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
  const { t } = useUiPreferences();
  return (
    <article className="dashboard-card maturity-card">
      <div className="dashboard-card-label">{t("observatory.maturity")}</div>

      {isLoading && (
        <div className="maturity-state-message">{t("cell.maturityLoading")}</div>
      )}

      {!isLoading && error && (
        <div className="maturity-state-message is-error">
          {t("cell.maturityError")}
        </div>
      )}

      {!isLoading && !error && !maturity && (
        <div className="maturity-state-message">
          {t("cell.maturityEmpty")}
        </div>
      )}

      {!isLoading && !error && maturity && (
        <>
          <div className="maturity-summary">
            <strong className="maturity-value">
              {formatPercent(maturity.value ?? maturity.maturity)}
            </strong>
            <span className="maturity-badge">
              {translateMaturityState(maturity.state, t)}
            </span>
          </div>

          <p className="maturity-description">
            {t("cell.maturityDescription")}
          </p>

          <div className="maturity-metrics">
            <MaturityMetric
              label={t("cell.normalizedMagnitude")}
              value={formatDecimal(maturity.normalizedMagnitude, 3)}
            />
            <MaturityMetric
              label={t("cell.temporalVariance")}
              value={formatDecimal(maturity.temporalVariance, 4)}
            />
            <MaturityMetric
              label={t("cell.convergence")}
              value={formatDecimal(maturity.convergence, 4)}
            />
            <MaturityMetric
              label={t("cell.sampleSize")}
              value={formatInteger(maturity.sampleSize)}
            />
            <MaturityMetric
              label={t("cell.dominantTrait")}
              value={maturity.dominantTrait ?? "--"}
            />
          </div>
        </>
      )}
    </article>
  );
}

function translateMaturityState(state, t) {
  const value = String(state ?? "unknown").toLowerCase();
  const key = ({ stable: "status.stable", growing: "observatory.growing", insufficient: "status.insufficient", unknown: "status.unknown" })[value];
  return (key ? t(key) : value).toUpperCase();
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
  if (!Number.isFinite(value)) {
    return "--";
  }

  const normalized = value <= 1 ? value * 100 : value;
  const percent = Math.max(0, Math.min(100, normalized));
  return `${Math.round(percent)}%`;
}

function formatDecimal(value, digits) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

function formatInteger(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return String(Math.round(value));
}
