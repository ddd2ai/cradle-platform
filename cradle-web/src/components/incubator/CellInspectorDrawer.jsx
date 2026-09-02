import { useEffect, useState } from "react";
import { DnaDimensionsCard } from "../cell/DnaDimensionsCard";
import { LifecycleCard } from "../cell/LifecycleCard";
import { MaturityCard } from "../cell/MaturityCard";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function CellInspectorDrawer({
  cell,
  visual,
  isOpen,
  isLoading,
  error,
  activeAction,
  actionMessage,
  actionError,
  activeOperation,
  operationError,
  fuseCandidates,
  selectedFuseCellIds,
  onActivate,
  onDeactivate,
  onClose,
  onStabilize,
  onDivide,
  onOpenFuseSelection,
  onToggleFuseCell,
  onCancelFuse,
  onContinueFuse,
}) {
  const { t } = useUiPreferences();
  const [mode, setMode] = useState("details");

  useEffect(() => {
    setMode("details");
  }, [cell?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const isBusy = Boolean(activeOperation);
  const className = [
    "cell-inspector-drawer",
    isOpen ? "cell-inspector-drawer--open" : "cell-inspector-drawer--closed",
  ].join(" ");

  function handleOpenFuse() {
    if (isBusy || !cell || fuseCandidates.length === 0) {
      return;
    }

    onOpenFuseSelection();
    setMode("fuse");
  }

  function handleBackFromFuse() {
    if (isBusy) {
      return;
    }

    onCancelFuse();
    setMode("details");
  }

  function handleContinueFuse() {
    onContinueFuse();
    setMode("details");
  }

  return (
    <aside
      className={className}
      aria-hidden={!isOpen}
      aria-label={t("cell.inspector")}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {cell && visual ? (
        <>
          <header className="cell-inspector-drawer__header">
            <div className="cell-inspector-drawer__identity">
              <span
                className="cell-inspector-drawer__avatar"
                style={{ "--cell-primary": visual.palette.primary }}
                aria-hidden="true"
              >
                <img src={visual.textureSrc} alt="" />
              </span>
              <div>
                <h2>{visual.name ?? visual.id}</h2>
                <span>{formatStatus(cell.status, t)}</span>
              </div>
            </div>
            <button
              type="button"
              className="cell-inspector-drawer__close"
              onClick={onClose}
              aria-label={t("cell.closeInspector")}
            >
              ×
            </button>
          </header>

          {mode === "details" && (
            <>
              <ActivationControls
                cell={cell}
                activeAction={activeAction}
                message={actionMessage}
                error={actionError}
                onActivate={onActivate}
                onDeactivate={onDeactivate}
                t={t}
              />
              <CellOperationControls
                visual={visual}
                activeOperation={activeOperation}
                isBusy={isBusy}
                canFuse={fuseCandidates.length > 0}
                onStabilize={onStabilize}
                onDivide={onDivide}
                onOpenFuse={handleOpenFuse}
                t={t}
              />
            </>
          )}

          <div className="cell-inspector-drawer__content selected-cell-panel">
            {isLoading && <SkeletonCards />}
            {!isLoading && error && (
              <div className="selected-cell-panel__notice">
                {t("cell.partialLoadError")}
              </div>
            )}
            {!isLoading && mode === "fuse" ? (
              <FuseSelectionPanel
                candidates={fuseCandidates}
                selectedFuseCellIds={selectedFuseCellIds}
                isBusy={isBusy}
                error={operationError}
                onToggleFuseCell={onToggleFuseCell}
                onBack={handleBackFromFuse}
                onCancel={handleBackFromFuse}
                onContinue={handleContinueFuse}
                t={t}
              />
            ) : (
              !isLoading && (
                <>
                  <LifecycleCard lifecycle={visual.lifecycleInfo} />
                  <MaturityCard maturity={visual.maturityInfo} />
                  <DnaDimensionsCard dimensions={visual.dimensions} />
                </>
              )
            )}
          </div>
        </>
      ) : isLoading ? (
        <div className="cell-inspector-drawer__content selected-cell-panel">
          <SkeletonCards />
        </div>
      ) : null}
    </aside>
  );
}

function SkeletonCards() {
  return Array.from({ length: 4 }, (_, index) => (
    <div key={index} className="selected-cell-card incubator-card-skeleton">
      <span />
      <span />
      <span />
    </div>
  ));
}

function ActivationControls({
  cell,
  activeAction,
  message,
  error,
  onActivate,
  onDeactivate,
  t,
}) {
  const status = String(cell.status ?? "").toLowerCase();
  const isActive = cell.active === true || ["active", "running"].includes(status);
  const isIdle = cell.active === false || ["idle", "inactive"].includes(status);
  const isBusy = Boolean(activeAction);

  return (
    <section className="cell-inspector-drawer__activation" aria-label={t("cell.cultivationState")}>
      <div className="cell-inspector-drawer__activation-buttons">
        <button
          type="button"
          onClick={onActivate}
          disabled={isBusy || isActive}
        >
          {activeAction === "activate" && <span className="button-spinner" />}
          {t(activeAction === "activate" ? "cell.activating" : "cell.activate")}
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          disabled={isBusy || isIdle}
        >
          {activeAction === "deactivate" && <span className="button-spinner" />}
          {t(activeAction === "deactivate" ? "cell.deactivating" : "cell.deactivate")}
        </button>
      </div>
      <div className="cell-inspector-drawer__activation-feedback" aria-live="polite">
        {!activeAction && message && <span className="is-success">{message}</span>}
        {!activeAction && error && <span className="is-error">{error}</span>}
      </div>
    </section>
  );
}

function CellOperationControls({
  visual,
  activeOperation,
  isBusy,
  canFuse,
  onStabilize,
  onDivide,
  onOpenFuse,
  t,
}) {
  return (
    <section className="cell-inspector-drawer__actions" aria-label={t("cell.operations")}>
      <button
        type="button"
        onClick={onStabilize}
        disabled={isBusy}
        aria-label={t("cell.stabilizeCell", { cell: visual.id })}
      >
        {activeOperation === "stabilize" && <span className="button-spinner" />}
        {t(activeOperation === "stabilize" ? "cell.stabilizing" : "cell.stabilize")}
      </button>
      <button
        type="button"
        onClick={onDivide}
        disabled={isBusy}
        aria-label={t("cell.divideCell", { cell: visual.id })}
      >
        {activeOperation === "divide" && <span className="button-spinner" />}
        {t(activeOperation === "divide" ? "cell.dividing" : "cell.divide")}
      </button>
      <button
        type="button"
        onClick={onOpenFuse}
        disabled={isBusy || !canFuse}
        aria-label={t("cell.fuseCell", { cell: visual.id })}
      >
        {activeOperation === "fuse" && <span className="button-spinner" />}
        {t(activeOperation === "fuse" ? "cell.fusing" : "cell.fuse")}
      </button>
    </section>
  );
}

function FuseSelectionPanel({
  candidates,
  selectedFuseCellIds,
  isBusy,
  error,
  onToggleFuseCell,
  onBack,
  onCancel,
  onContinue,
  t,
}) {
  return (
    <section className="cell-inspector-fuse" aria-label={t("cell.fuseSelection")}>
      <header className="cell-inspector-fuse__header">
        <span>{t("cell.fuseWith")}</span>
        <strong>{t("cell.selectedCount", { count: selectedFuseCellIds.length })}</strong>
      </header>
      <div className="cell-inspector-fuse__list" role="group" aria-label={t("cell.fuseCandidates")}>
        {candidates.map((candidate) => {
          const checked = selectedFuseCellIds.includes(candidate.id);

          return (
            <label
              key={candidate.id}
              className={`cell-inspector-fuse__option${checked ? " is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={isBusy}
                onChange={() => onToggleFuseCell(candidate.id)}
              />
              <span>
                <strong>{candidate.name ?? candidate.id}</strong>
                <small>{formatStatus(candidate.status, t)}</small>
              </span>
            </label>
          );
        })}
      </div>
      {error && <div className="cell-inspector-fuse__error">{error}</div>}
      <footer className="cell-inspector-fuse__footer">
        <button type="button" className="secondary-button" onClick={onBack} disabled={isBusy}>
          {t("common.back")}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={isBusy}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onContinue}
          disabled={isBusy || selectedFuseCellIds.length === 0}
        >
          {t("cell.fuse")}
        </button>
      </footer>
    </section>
  );
}

function formatStatus(status, t) {
  const value = String(status ?? "unknown").toLowerCase();
  const key = ({ active: "status.active", running: "status.active", idle: "status.idle", inactive: "status.idle", stable: "status.stable", growing: "observatory.growing", unknown: "status.unknown" })[value];
  if (key) return t(key);
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
