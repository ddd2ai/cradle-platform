import { useEffect, useMemo, useState } from "react";
import { fetchObservatory } from "../api/cradleClient";
import { buildObservatoryModel } from "../domain/observatoryModel";

export function ObservatoryPage() {
  const [snapshot, setSnapshot] = useState({ cells: [], observedAt: null });
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [isCapabilityGuideOpen, setIsCapabilityGuideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchObservatory()
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setSelectedCellId(data.cells?.[0]?.cellId ?? null);
      })
      .catch((loadError) => !cancelled && setError(loadError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isCapabilityGuideOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setIsCapabilityGuideOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isCapabilityGuideOpen]);

  const model = useMemo(() => buildObservatoryModel(snapshot.cells ?? []), [snapshot.cells]);
  const selected = model.cells.find((cell) => cell.cellId === selectedCellId) ?? model.cells[0];

  return (
    <section className="platform-page observatory-page">
      <div className="page-heading observatory-heading">
        <div>
          <h1>Observatory</h1>
          <p>Read cultivation evidence, compare Cells, and find exceptions that need attention.</p>
        </div>
        <span className="observed-at">Observed {formatDate(snapshot.observedAt)}</span>
      </div>

      {loading && <div className="observatory-state">Collecting observations…</div>}
      {!loading && error && <div className="observatory-state is-error">{error}</div>}
      {!loading && !error && model.cells.length === 0 && <div className="observatory-state">No Cells are available to observe.</div>}
      {!loading && !error && model.cells.length > 0 && (
        <>
          <div className="observation-strip">
            <Metric label="Observed Cells" value={model.cells.length} tone="neutral" />
            <Metric label="Stable" value={model.stableCount} tone="good" />
            <Metric label="Growing" value={model.growingCount} tone="growth" />
            <Metric label="Needs Attention" value={model.attentionCount} tone={model.attentionCount ? "warn" : "neutral"} />
            <Metric label="Insufficient Evidence" value={model.insufficientCount} tone={model.insufficientCount ? "muted" : "neutral"} />
          </div>

          <div className="observatory-grid">
            <article className="observation-card trend-card">
              <CardHeading title="Maturity trajectory" detail={selected?.name ?? "Cell"} />
              <MaturityChart points={selected?.maturityTrend ?? []} />
              <CellSelector cells={model.cells} selectedCellId={selected?.cellId} onSelect={setSelectedCellId} />
            </article>

            <article className="observation-card attention-card">
              <CardHeading title="Attention queue" detail={`${model.attention.length} evidence exceptions`} />
              {model.attention.length === 0 ? (
                <div className="empty-observation">No current exceptions in the recorded cultivation state.</div>
              ) : (
                <div className="attention-list">
                  {model.attention.map((item) => (
                    <button type="button" key={item.cellId} onClick={() => setSelectedCellId(item.cellId)}>
                      <span className={`attention-marker attention-marker--${item.tone}`} />
                      <span><strong>{item.name}</strong><small>{item.reason}</small></span>
                      <span className="attention-state">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </article>

            <article className="observation-card fitness-card">
              <CardHeading title="Capability × stability" detail="All observed Cells" />
              <CapabilityStabilityPlot
                cells={model.cells}
                selectedCellId={selected?.cellId}
                onSelect={setSelectedCellId}
                onOpenGuide={() => setIsCapabilityGuideOpen(true)}
              />
            </article>

            <article className="observation-card comparison-card">
              <CardHeading title="Cell comparison" detail="Recorded state" />
              <div className="comparison-table" role="table" aria-label="Cell cultivation comparison">
                <div className="comparison-row comparison-header" role="row"><span>Cell</span><span>State</span><span>Maturity</span><span>Quality</span><span>Samples</span></div>
                {model.cells.map((cell) => (
                  <button type="button" className={`comparison-row ${selected?.cellId === cell.cellId ? "selected" : ""}`} key={cell.cellId} onClick={() => setSelectedCellId(cell.cellId)}>
                    <span><strong>{cell.name}</strong><small>Gen {cell.generation}</small></span>
                    <span><i className={`state-dot state-dot--${cell.tone}`} />{cell.stateLabel}</span>
                    <span>{cell.maturityPercent === null ? "—" : `${cell.maturityPercent}%`}</span>
                    <span>{cell.qualityOutcome ? prettyTrait(cell.qualityOutcome) : "No decision"}</span>
                    <span>{cell.sampleSize}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
          {isCapabilityGuideOpen && (
            <CapabilityGuideDialog onClose={() => setIsCapabilityGuideOpen(false)} />
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value, tone }) {
  return <div className={`observation-metric observation-metric--${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function CardHeading({ title, detail }) {
  return <header className="observation-card-heading"><h2>{title}</h2><span>{detail}</span></header>;
}

function CellSelector({ cells, selectedCellId, onSelect }) {
  return <div className="chart-cell-selector">{cells.map((cell) => <button type="button" className={cell.cellId === selectedCellId ? "selected" : ""} key={cell.cellId} onClick={() => onSelect(cell.cellId)}>{cell.name}</button>)}</div>;
}

function MaturityChart({ points }) {
  const observed = points.filter((point) => point.percent !== null);
  if (observed.length < 2) {
    return <div className="chart-insufficient"><strong>Insufficient evidence</strong><span>At least two recorded maturity points are required for a trend.</span></div>;
  }
  const coordinates = observed.map((point, index) => ({
    x: 6 + (index / (observed.length - 1)) * 88,
    y: 88 - (Number(point.percent) / 100) * 72,
    ...point,
  }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  return (
    <div className="maturity-chart">
      <div className="chart-scale"><span>100</span><span>50</span><span>0</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Maturity percentage over recorded DNA observations">
        <path className="chart-grid" d="M0 16 H100 M0 52 H100 M0 88 H100" />
        <path className="chart-area" d={`${line} L${coordinates.at(-1).x},88 L${coordinates[0].x},88 Z`} />
        <path className="chart-line" d={line} />
        {coordinates.map((point, index) => <circle key={`${point.at}-${index}`} cx={point.x} cy={point.y} r="1.7" />)}
      </svg>
      <div className="chart-caption"><span>{formatDate(observed[0].at)}</span><strong>{observed.at(-1).percent}% current maturity</strong><span>{formatDate(observed.at(-1).at)}</span></div>
    </div>
  );
}

function CapabilityStabilityPlot({ cells, selectedCellId, onSelect, onOpenGuide }) {
  const selected = cells.find((cell) => cell.cellId === selectedCellId) ?? cells[0];
  return (
    <div className="fitness-plot-shell">
      <div className="fitness-y-label">Stability</div>
      <div className="fitness-plot" role="img" aria-label="Cell capability and stability distribution">
        <span className="fitness-quadrant fitness-quadrant--stable">Stable foundation</span>
        <span className="fitness-quadrant fitness-quadrant--ready">Strong &amp; stable</span>
        <span className="fitness-quadrant fitness-quadrant--early">Early signal</span>
        <span className="fitness-quadrant fitness-quadrant--volatile">Capable, variable</span>
        {cells.map((cell) => (
          <button
            type="button"
            key={cell.cellId}
            className={`fitness-point fitness-point--${cell.tone} ${cell.cellId === selectedCellId ? "selected" : ""} ${cell.stability === null ? "insufficient" : ""}`}
            style={{
              left: `${8 + cell.capability * 84}%`,
              bottom: `${10 + (cell.stability ?? 0) * 78}%`,
            }}
            onClick={() => onSelect(cell.cellId)}
            title={`${cell.name}: ${Math.round(cell.capability * 100)}% capability, ${cell.stability === null ? "insufficient stability evidence" : `${Math.round(cell.stability * 100)}% stability`}`}
          >
            <span>{cell.name}</span>
          </button>
        ))}
      </div>
      <div className="fitness-x-label">Capability</div>
      <div className="fitness-reading">
        <strong>{selected?.name}</strong>
        <span>Capability {Math.round((selected?.capability ?? 0) * 100)}%</span>
        <span>Stability {selected?.stability === null ? "Insufficient evidence" : `${Math.round((selected?.stability ?? 0) * 100)}%`}</span>
        <button type="button" className="fitness-guide-button" onClick={onOpenGuide}>
          <span aria-hidden="true">?</span>
          How to read
        </button>
      </div>
    </div>
  );
}

function CapabilityGuideDialog({ onClose }) {
  return (
    <div className="observation-guide-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="observation-guide" role="dialog" aria-modal="true" aria-labelledby="capability-guide-title">
        <header>
          <div>
            <span className="observation-guide-kicker">Chart guide</span>
            <h2 id="capability-guide-title">How to read Capability × Stability</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chart guide" autoFocus>×</button>
        </header>

        <div className="observation-guide-formula">
          <span>Maturity</span>
          <strong>Capability × Stability</strong>
        </div>
        <p className="observation-guide-intro">
          Each point represents a Cell. Moving right means stronger capability; moving up means its recent DNA is more convergent and stable.
        </p>

        <div className="observation-guide-map-shell">
          <span className="observation-guide-map-y">Stability</span>
          <div className="observation-guide-map">
            <div className="guide-map-quadrant guide-map-quadrant--blue">
              <strong>Stable foundation</strong>
              <div className="guide-map-callout"><i /><b>↖</b><span>Stable, but capability is still low</span></div>
            </div>
            <div className="guide-map-quadrant guide-map-quadrant--green">
              <strong>Strong &amp; stable</strong>
              <div className="guide-map-callout"><i /><b>↗</b><span>Strong capability and stable</span></div>
            </div>
            <div className="guide-map-quadrant guide-map-quadrant--violet">
              <strong>Early signal</strong>
              <div className="guide-map-callout"><i /><b>↙</b><span>Collect more evidence first</span></div>
            </div>
            <div className="guide-map-quadrant guide-map-quadrant--amber">
              <strong>Capable, variable</strong>
              <div className="guide-map-callout"><i /><b>↘</b><span>Capable, but still variable</span></div>
            </div>
          </div>
          <span className="observation-guide-map-x">Capability</span>
        </div>

        <div className="observation-guide-legend" aria-label="Data point color legend">
          <span><i className="is-stable" />Stable</span>
          <span><i className="is-growing" />Growing</span>
          <span><i className="is-attention" />Needs Attention</span>
          <span><i className="is-insufficient" />Insufficient Evidence</span>
          <span><i className="is-neutral" />Dormant / Idle</span>
        </div>

        <div className="observation-guide-notes-grid">
          <section>
            <h3>How the chart is calculated</h3>
            <ul>
              <li>Capability comes from DNA normalized magnitude and represents current overall capability strength.</li>
              <li>Stability comes from convergence across recent DNA history; less variation means greater stability.</li>
              <li>With fewer than two DNA observations, Stability cannot be calculated and the point is marked as insufficient evidence.</li>
              <li>Point color represents cultivation state, such as Stable, Growing, or Needs Attention.</li>
              <li>Position does not prove that an Artifact is acceptable; also check Quality and the Attention Queue.</li>
            </ul>
          </section>
          <section>
            <h3>What to watch for</h3>
            <ul>
              <li>A Cell remaining in the lower right has capability, but its stimuli or responsibility boundary may be inconsistent.</li>
              <li>A Cell remaining in the upper left is stable, but may lack tasks that develop stronger capability.</li>
              <li>Movement toward the upper right usually indicates increasing capability and convergence—a healthier cultivation trend.</li>
            </ul>
          </section>
        </div>
        <footer><button type="button" className="primary-button" onClick={onClose}>Got it</button></footer>
      </section>
    </div>
  );
}

function prettyTrait(value) { return String(value).toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value) {
  if (!value) return "not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "not recorded" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
