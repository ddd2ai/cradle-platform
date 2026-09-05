import { useEffect, useMemo, useState } from "react";
import { fetchObservatory, fetchOperations } from "../api/cradleClient";
import { buildObservatoryModel } from "../domain/observatoryModel";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function ObservatoryPage() {
  const { locale, t } = useUiPreferences();
  const [snapshot, setSnapshot] = useState({ cells: [], observedAt: null });
  const [operations, setOperations] = useState([]);
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [selectedAttentionId, setSelectedAttentionId] = useState(null);
  const [attentionDialog, setAttentionDialog] = useState(null);
  const [isCapabilityGuideOpen, setIsCapabilityGuideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadObservatory() {
      try {
        const [observatoryResult, operationResult] = await Promise.allSettled([
          fetchObservatory(),
          fetchOperations(),
        ]);

        if (cancelled) return;

        if (observatoryResult.status === "fulfilled") {
          setSnapshot(observatoryResult.value);
          setSelectedCellId(observatoryResult.value.cells?.[0]?.cellId ?? null);
        } else {
          setError(observatoryResult.reason?.message ?? "Failed to fetch Observatory");
        }

        if (operationResult.status === "fulfilled") {
          setOperations(operationResult.value);
        } else {
          setOperations([]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadObservatory();
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

  useEffect(() => {
    if (!attentionDialog) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setAttentionDialog(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [attentionDialog]);

  const model = useMemo(() => buildObservatoryModel(snapshot.cells ?? [], operations), [snapshot.cells, operations]);
  const selected = model.cells.find((cell) => cell.cellId === selectedCellId) ?? model.cells[0];

  function reviewAttention(item) {
    setSelectedAttentionId(item.cellId);
    setAttentionDialog(item);
    if (model.cells.some((cell) => cell.cellId === item.cellId)) {
      setSelectedCellId(item.cellId);
    }
  }

  return (
    <section className="platform-page observatory-page">
      <div className="page-heading observatory-heading">
        <div>
          <h1>{t("nav.observatory")}</h1>
          <p>{t("observatory.description")}</p>
        </div>
        <span className="observed-at">{t("observatory.observed", { date: formatDate(snapshot.observedAt, locale, t) })}</span>
      </div>

      {loading && <div className="observatory-state">{t("observatory.loading")}</div>}
      {!loading && error && <div className="observatory-state is-error">{error}</div>}
      {!loading && !error && model.cells.length === 0 && <div className="observatory-state">{t("observatory.empty")}</div>}
      {!loading && !error && model.cells.length > 0 && (
        <>
          <div className="observation-strip">
            <Metric label={t("observatory.observedCells")} value={model.cells.length} tone="neutral" />
            <Metric label={t("observatory.stable")} value={model.stableCount} tone="good" />
            <Metric label={t("observatory.growing")} value={model.growingCount} tone="growth" />
            <Metric label={t("observatory.needsAttention")} value={model.attentionCount} tone={model.attentionCount ? "warn" : "neutral"} />
            <Metric label={t("observatory.insufficientEvidence")} value={model.insufficientCount} tone={model.insufficientCount ? "muted" : "neutral"} />
          </div>

          <div className="observatory-grid">
            <article className="observation-card trend-card">
              <CardHeading title={t("observatory.maturityTrajectory")} detail={selected?.name ?? t("observatory.cell")} />
              <MaturityChart points={selected?.maturityTrend ?? []} locale={locale} t={t} />
              <CellSelector cells={model.cells} selectedCellId={selected?.cellId} onSelect={setSelectedCellId} />
            </article>

            <article className="observation-card attention-card">
              <CardHeading title={t("observatory.attentionQueue")} detail={t("observatory.evidenceExceptions", { count: model.attention.length })} />
              {model.attention.length === 0 ? (
                <div className="empty-observation">{t("observatory.noExceptions")}</div>
              ) : (
                <div className="attention-list">
                  {model.attention.map((item) => (
                    <div className={`attention-list__item ${selectedAttentionId === item.cellId ? "selected" : ""}`} key={item.cellId}>
                      <span className={`attention-marker attention-marker--${item.tone}`} />
                      <span><strong>{item.name}</strong><small>{translateAttentionReason(item, t)}</small></span>
                      <button type="button" className="attention-state" onClick={() => reviewAttention(item)}>
                        {translateStatus(item.label, t)}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="observation-card fitness-card">
              <CardHeading title={t("observatory.capabilityStability")} detail={t("observatory.allCells")} />
              <CapabilityStabilityPlot
                cells={model.cells}
                selectedCellId={selected?.cellId}
                onSelect={setSelectedCellId}
                onOpenGuide={() => setIsCapabilityGuideOpen(true)}
                t={t}
              />
            </article>

            <article className="observation-card comparison-card">
              <CardHeading title={t("observatory.cellComparison")} detail={t("observatory.recordedState")} />
              <div className="comparison-table" role="table" aria-label={t("observatory.comparisonLabel")}>
                <div className="comparison-row comparison-header" role="row"><span>{t("observatory.cell")}</span><span>{t("observatory.state")}</span><span>{t("observatory.maturity")}</span><span>{t("observatory.quality")}</span><span>{t("observatory.samples")}</span></div>
                {model.cells.map((cell) => (
                  <button type="button" className={`comparison-row ${selected?.cellId === cell.cellId ? "selected" : ""}`} key={cell.cellId} onClick={() => setSelectedCellId(cell.cellId)}>
                    <span><strong>{cell.name}</strong><small>{t("observatory.generation", { generation: cell.generation })}</small></span>
                    <span><i className={`state-dot state-dot--${cell.tone}`} />{translateStatus(cell.stateLabel, t)}</span>
                    <span>{cell.maturityPercent === null ? "—" : `${cell.maturityPercent}%`}</span>
                    <span>{cell.qualityOutcome ? prettyTrait(cell.qualityOutcome) : t("observatory.noDecision")}</span>
                    <span>{cell.sampleSize}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
          {isCapabilityGuideOpen && (
            <CapabilityGuideDialog onClose={() => setIsCapabilityGuideOpen(false)} t={t} />
          )}
          {attentionDialog && (
            <AttentionDialog item={attentionDialog} onClose={() => setAttentionDialog(null)} t={t} />
          )}
        </>
      )}
    </section>
  );
}

function AttentionDialog({ item, onClose, t }) {
  return (
    <div className="observation-guide-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="attention-dialog" role="dialog" aria-modal="true" aria-labelledby="attention-dialog-title">
        <header>
          <div>
            <span className="observation-guide-kicker">{t("observatory.attentionQueue")}</span>
            <h2 id="attention-dialog-title">{item.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("guide.close")} autoFocus>×</button>
        </header>
        <div className="attention-dialog__body">
          <span>{t("status.attention")}</span>
          <p>{translateAttentionReason(item, t)}</p>
        </div>
        <footer><button type="button" className="primary-button" onClick={onClose}>{t("guide.close")}</button></footer>
      </section>
    </div>
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

function MaturityChart({ points, locale, t }) {
  const observed = points.filter((point) => point.percent !== null);
  if (observed.length < 2) {
    return <div className="chart-insufficient"><strong>{t("observatory.insufficientTitle")}</strong><span>{t("observatory.insufficientTrend")}</span></div>;
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
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={t("observatory.maturityChartLabel")}>
        <path className="chart-grid" d="M0 16 H100 M0 52 H100 M0 88 H100" />
        <path className="chart-area" d={`${line} L${coordinates.at(-1).x},88 L${coordinates[0].x},88 Z`} />
        <path className="chart-line" d={line} />
        {coordinates.map((point, index) => <circle key={`${point.at}-${index}`} cx={point.x} cy={point.y} r="1.7" />)}
      </svg>
      <div className="chart-caption"><span>{formatDate(observed[0].at, locale, t)}</span><strong>{t("observatory.currentMaturity", { percent: observed.at(-1).percent })}</strong><span>{formatDate(observed.at(-1).at, locale, t)}</span></div>
    </div>
  );
}

function CapabilityStabilityPlot({ cells, selectedCellId, onSelect, onOpenGuide, t }) {
  const selected = cells.find((cell) => cell.cellId === selectedCellId) ?? cells[0];
  return (
    <div className="fitness-plot-shell">
      <div className="fitness-y-label">{t("observatory.stability")}</div>
      <div className="fitness-plot" role="img" aria-label={t("observatory.capabilityChartLabel")}>
        <span className="fitness-quadrant fitness-quadrant--stable">{t("observatory.stableFoundation")}</span>
        <span className="fitness-quadrant fitness-quadrant--ready">{t("observatory.strongStable")}</span>
        <span className="fitness-quadrant fitness-quadrant--early">{t("observatory.earlySignal")}</span>
        <span className="fitness-quadrant fitness-quadrant--volatile">{t("observatory.capableVariable")}</span>
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
            title={`${cell.name}: ${t("observatory.capabilityValue", { percent: Math.round(cell.capability * 100) })}, ${t("observatory.stabilityValue", { value: cell.stability === null ? t("observatory.insufficientEvidence") : `${Math.round(cell.stability * 100)}%` })}`}
          >
            <span>{cell.name}</span>
          </button>
        ))}
      </div>
      <div className="fitness-x-label">{t("observatory.capability")}</div>
      <div className="fitness-reading">
        <strong>{selected?.name}</strong>
        <span>{t("observatory.capabilityValue", { percent: Math.round((selected?.capability ?? 0) * 100) })}</span>
        <span>{t("observatory.stabilityValue", { value: selected?.stability === null ? t("observatory.insufficientEvidence") : `${Math.round((selected?.stability ?? 0) * 100)}%` })}</span>
        <button type="button" className="fitness-guide-button" onClick={onOpenGuide}>
          <span aria-hidden="true">?</span>
          {t("observatory.howToRead")}
        </button>
      </div>
    </div>
  );
}

function CapabilityGuideDialog({ onClose, t }) {
  return (
    <div className="observation-guide-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="observation-guide" role="dialog" aria-modal="true" aria-labelledby="capability-guide-title">
        <header>
          <div>
            <span className="observation-guide-kicker">{t("guide.kicker")}</span>
            <h2 id="capability-guide-title">{t("guide.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("guide.close")} autoFocus>×</button>
        </header>

        <div className="observation-guide-formula">
          <span>{t("observatory.maturity")}</span>
          <strong>{t("observatory.capabilityStability")}</strong>
        </div>
        <p className="observation-guide-intro">
          {t("guide.intro")}
        </p>

        <div className="observation-guide-map-shell">
          <span className="observation-guide-map-y">{t("observatory.stability")}</span>
          <div className="observation-guide-map">
            <div className="guide-map-quadrant guide-map-quadrant--blue">
              <strong>{t("observatory.stableFoundation")}</strong>
              <div className="guide-map-callout"><i /><b>↖</b><span>{t("guide.stableLow")}</span></div>
            </div>
            <div className="guide-map-quadrant guide-map-quadrant--green">
              <strong>{t("observatory.strongStable")}</strong>
              <div className="guide-map-callout"><i /><b>↗</b><span>{t("guide.strongStable")}</span></div>
            </div>
            <div className="guide-map-quadrant guide-map-quadrant--violet">
              <strong>{t("observatory.earlySignal")}</strong>
              <div className="guide-map-callout"><i /><b>↙</b><span>{t("guide.collectEvidence")}</span></div>
            </div>
            <div className="guide-map-quadrant guide-map-quadrant--amber">
              <strong>{t("observatory.capableVariable")}</strong>
              <div className="guide-map-callout"><i /><b>↘</b><span>{t("guide.capableVariable")}</span></div>
            </div>
          </div>
          <span className="observation-guide-map-x">{t("observatory.capability")}</span>
        </div>

        <div className="observation-guide-legend" aria-label={t("guide.legend")}>
          <span><i className="is-stable" />{t("observatory.stable")}</span>
          <span><i className="is-growing" />{t("observatory.growing")}</span>
          <span><i className="is-attention" />{t("observatory.needsAttention")}</span>
          <span><i className="is-insufficient" />{t("observatory.insufficientEvidence")}</span>
          <span><i className="is-neutral" />{t("guide.dormantIdle")}</span>
        </div>

        <div className="observation-guide-notes-grid">
          <section>
            <h3>{t("guide.calculation")}</h3>
            <ul>
              <li>{t("guide.capabilityDefinition")}</li>
              <li>{t("guide.stabilityDefinition")}</li>
              <li>{t("guide.sampleDefinition")}</li>
              <li>{t("guide.colorDefinition")}</li>
              <li>{t("guide.qualityBoundary")}</li>
            </ul>
          </section>
          <section>
            <h3>{t("guide.watch")}</h3>
            <ul>
              <li>{t("guide.lowerRight")}</li>
              <li>{t("guide.upperLeft")}</li>
              <li>{t("guide.upperRight")}</li>
            </ul>
          </section>
        </div>
        <footer><button type="button" className="primary-button" onClick={onClose}>{t("guide.gotIt")}</button></footer>
      </section>
    </div>
  );
}

function prettyTrait(value) { return String(value).toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function translateStatus(value, t) {
  const key = String(value ?? "").trim().toLowerCase().replaceAll(" ", "_");
  const statusKeys = {
    attention: "status.attention",
    growing: "observatory.growing",
    stable: "observatory.stable",
    insufficient: "status.insufficient",
    observed: "status.observed",
    review: "status.review",
    evidence: "status.evidence",
  };
  return statusKeys[key] ? t(statusKeys[key]) : value;
}

function translateAttentionReason(item, t) {
  if (item.label === "Evidence" && /^Only \d+ DNA samples?;/.test(item.reason)) {
    return t("observatory.sampleReason", { count: item.reason.match(/\d+/)?.[0] ?? 0 });
  }
  if (item.reason === "Cultivation reported that intervention is required.") return t("observatory.interventionReason");
  return item.reason;
}

function formatDate(value, locale, t) {
  if (!value) return t("observatory.notRecorded");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("observatory.notRecorded") : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
