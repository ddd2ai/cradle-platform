import { toCellViewModel } from "../domain/cellViewModel";
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
  const maturityText =
    typeof view.maturity === "number"
      ? `${Math.round(view.maturity <= 1 ? view.maturity * 100 : view.maturity)}%`
      : "—";

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

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-label">Lifecycle</div>
          <div className="dashboard-card-value">{view.lifecycle}</div>
          <p>Current software life-cycle state.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">Maturity</div>
          <div className="dashboard-card-value">{maturityText}</div>
          <p>Estimated maturity of the selected cell.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">DNA Dimensions</div>
          <div className="dashboard-card-value">{view.dnaDimensions ?? "—"}</div>
          <p>Active DNA traits currently being observed.</p>
        </article>
      </div>

      <CellWorkspacePanel cellId={view.id} workspacePath={view.workspacePath} />
    </section>
  );
}
