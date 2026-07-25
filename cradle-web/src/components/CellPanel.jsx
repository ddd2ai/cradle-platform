import { toCellViewModel } from "../domain/cellViewModel";
import { DnaDimensionsCard } from "./cell/DnaDimensionsCard";
import { LifecycleCard } from "./cell/LifecycleCard";
import { MaturityCard } from "./cell/MaturityCard";
import { mapDnaDimensions } from "./cell/dna-dimensions";
import { CellWorkspacePanel } from "./workspace/CellWorkspacePanel";

export function CellPanel({
  cell,
  onActivate,
  onDeactivate,
  activeAction,
  actionMessage,
  actionError,
}) {
  const view = toCellViewModel(cell);
  const normalizedStatus = String(
    view.status ?? view.lifecycle ?? "",
  ).toLowerCase();
  const isActive = normalizedStatus === "active" || normalizedStatus === "running";
  const isIdle = normalizedStatus === "idle" || normalizedStatus === "inactive";
  const isBusy = Boolean(activeAction);
  const dnaDimensions = mapDnaDimensions(view.dnaVector);

  return (
    <section className="cell-panel">
      {activeAction && (
        <div className="operation-banner">
          <span className="button-spinner" />
          Cradle is processing {activeAction} for {view.id}
        </div>
      )}
      <div className="cell-overview-card">
        <div className="cell-overview-header">
          <div className="cell-large-icon">🦠</div>
          <div className="cell-overview-title">
            <h2>{view.name}</h2>
            <p>{view.id}</p>
          </div>
          <div className={`cell-status-badge status-${normalizedStatus}`}>
            <span className="cell-status-dot" />
            {normalizedStatus || "unknown"}
          </div>
        </div>

        <div className="cell-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onActivate}
            disabled={isBusy || isActive}
          >
            {activeAction === "activate" ? (
              <><span className="button-spinner" />Activating...</>
            ) : "Activate"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onDeactivate}
            disabled={isBusy || isIdle}
          >
            {activeAction === "deactivate" ? (
              <><span className="button-spinner" />Deactivating...</>
            ) : "Deactivate"}
          </button>
        </div>
        <div className="action-feedback" aria-live="polite">
          {activeAction && (
            <div className="action-feedback-item loading">
              Processing {activeAction}...
            </div>
          )}
          {!activeAction && actionMessage && (
            <div className="action-feedback-item success">✓ {actionMessage}</div>
          )}
          {!activeAction && actionError && (
            <div className="action-feedback-item error">✕ {actionError}</div>
          )}
        </div>
      </div>

      <div className="dashboard-grid cell-summary-grid">
        <LifecycleCard lifecycle={view.lifecycleInfo} />
        <MaturityCard maturity={view.maturityInfo} />
        <DnaDimensionsCard dimensions={dnaDimensions} />
      </div>

      <CellWorkspacePanel cellId={view.id} workspacePath={view.workspacePath} />
    </section>
  );
}
