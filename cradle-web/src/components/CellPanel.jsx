import { toCellViewModel } from "../domain/cellViewModel";
import { DnaDimensionsCard } from "./cell/DnaDimensionsCard";
import { LifecycleCard } from "./cell/LifecycleCard";
import { MaturityCard } from "./cell/MaturityCard";
import { mapDnaDimensions } from "./cell/dna-dimensions";
import { CellWorkspacePanel } from "./workspace/CellWorkspacePanel";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function CellPanel({
  cell,
  onActivate,
  onDeactivate,
  activeAction,
  actionMessage,
  actionError,
}) {
  const { t } = useUiPreferences();
  const view = toCellViewModel(cell);
  const normalizedStatus = String(
    view.status ?? view.lifecycle ?? "",
  ).toLowerCase();
  const isActive = normalizedStatus === "active" || normalizedStatus === "running";
  const isIdle = normalizedStatus === "idle" || normalizedStatus === "inactive";
  const isBusy = Boolean(activeAction);
  const dnaDimensions = mapDnaDimensions(view.dnaVector);

  return (
    <section className="cell-panel cell-detail-page">
      {activeAction && (
        <div className="operation-banner">
          <span className="button-spinner" />
          {t("cell.processing", { action: translateAction(activeAction, t), cell: view.id })}
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
            {translateCellStatus(normalizedStatus, t)}
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
              <><span className="button-spinner" />{t("cell.activating")}</>
            ) : t("cell.activate")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onDeactivate}
            disabled={isBusy || isIdle}
          >
            {activeAction === "deactivate" ? (
              <><span className="button-spinner" />{t("cell.deactivating")}</>
            ) : t("cell.deactivate")}
          </button>
        </div>
        <div className="action-feedback" aria-live="polite">
          {activeAction && (
            <div className="action-feedback-item loading">
              {t("cell.processingShort", { action: translateAction(activeAction, t) })}
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

function translateAction(action, t) {
  return ({ activate: t("cell.activate"), deactivate: t("cell.deactivate") })[action] ?? action;
}

function translateCellStatus(status, t) {
  const key = ({ active: "status.active", running: "status.active", idle: "status.idle", inactive: "status.idle" })[status];
  return key ? t(key) : status || t("status.unknown");
}
