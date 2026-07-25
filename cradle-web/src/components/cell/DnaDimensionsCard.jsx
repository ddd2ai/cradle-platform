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
  return (
    <article className="dashboard-card dna-dimensions-card">
      <div className="dashboard-card-label">DNA Dimensions</div>

      {isLoading && (
        <div className="dna-card-state">Loading DNA dimensions...</div>
      )}

      {!isLoading && error && (
        <div className="dna-card-state is-error">
          Unable to load DNA dimensions.
        </div>
      )}

      {!isLoading && !error && dimensions.length === 0 && (
        <div className="dna-card-state">No DNA dimensions available.</div>
      )}

      {!isLoading && !error && dimensions.length > 0 && (
        <div className="dna-dimension-list">
          {dimensions.map((dimension) => {
            const percent = normalizePercent(dimension.value);
            const label = formatDimensionName(dimension.name);

            return (
              <div key={dimension.name} className="dna-dimension-item">
                <div className="dna-dimension-header">
                  <span title={label}>{label}</span>
                  <span>{percent}%</span>
                </div>
                <div
                  className="dna-dimension-track"
                  role="progressbar"
                  aria-label={label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div
                    className="dna-dimension-fill"
                    style={{ width: `${percent}%` }}
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
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, percent)));
}

function formatDimensionName(name) {
  return name.replaceAll("_", " ").toUpperCase();
}
