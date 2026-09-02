import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

/**
 * @typedef {object} DnaDimension
 * @property {string} name
 * @property {number} value
 */

/**
 * @param {{
 *   dimensions: DnaDimension[];
 *   isLoading?: boolean;
 *   error?: string | null;
 * }} props
 */
export function DnaDimensionsCard({
  dimensions,
  isLoading = false,
  error = null,
}) {
  const { t } = useUiPreferences();
  return (
    <article className="dashboard-card dna-dimensions-card">
      <div className="dashboard-card-label">{t("cell.dnaProfile")}</div>

      {isLoading && (
        <div className="dna-card-state">{t("cell.dnaLoading")}</div>
      )}

      {!isLoading && error && (
        <div className="dna-card-state is-error">
          {t("cell.dnaError")}
        </div>
      )}

      {!isLoading && !error && dimensions.length === 0 && (
        <div className="dna-card-state">{t("cell.dnaEmpty")}</div>
      )}

      {!isLoading && !error && dimensions.length > 0 && (
        <div className="dna-dimension-list">
          {dimensions.map((dimension) => {
            const percent = normalizePercent(dimension.value);
            const label = formatDimensionName(dimension.name, t);

            return (
              <div key={dimension.name} className="dna-dimension-item">
                <div className="dna-dimension-header">
                  <span title={label}>{label}</span>
                  <span>{percent == null ? "--" : `${percent}%`}</span>
                </div>
                <div
                  className="dna-dimension-track"
                  role="progressbar"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent ?? undefined}
                >
                  <div
                    className="dna-dimension-fill"
                    style={{ width: `${percent ?? 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function normalizePercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const percent = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, percent)));
}

function formatDimensionName(name, t) {
  const key = `dna.${String(name).toLowerCase()}`;
  const translated = t(key);
  return translated === key ? name.replaceAll("_", " ").toUpperCase() : translated;
}
