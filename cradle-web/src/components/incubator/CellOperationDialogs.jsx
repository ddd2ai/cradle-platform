import { useEffect } from "react";
import { useOperationProgress } from "../../hooks/useOperationProgress.js";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function CellOperationDialogs({
  dialog,
  selectedCellId,
  selectedFuseCellIds,
  childCellId,
  activeOperation,
  operationId,
  error,
  onChangeChildCellId,
  onClose,
  onBackToFuseSelection,
  onConfirmStabilize,
  onConfirmDivide,
  onConfirmFuse,
}) {
  const { t } = useUiPreferences();
  // 直接訂閱 operation-progress store:progress 更新只會觸發本元件 re-render,
  // 不影響 IncubatorPage、IncubatorWorkspace、CellInspectorDrawer 等父/兄弟元件。
  const operationProgress = useOperationProgress(operationId);
  useEffect(() => {
    if (!dialog) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !activeOperation) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeOperation, dialog, onClose]);

  if (!dialog || !selectedCellId) {
    return null;
  }

  if (dialog === "stabilize") {
    return (
      <OperationDialog
        title={t("cell.stabilizeTitle")}
        description={t("cell.stabilizeDescription", { cell: selectedCellId })}
        onClose={onClose}
        busy={activeOperation === "stabilize"}
      >
        <p className="cell-operation-dialog__note">
          {t("cell.stabilizeNote")}
        </p>
        <OperationProgress operation={operationProgress} t={t} />
        <DialogError error={error} />
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={Boolean(activeOperation)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirmStabilize}
            disabled={Boolean(activeOperation)}
          >
            {t(activeOperation === "stabilize" ? "cell.stabilizing" : "cell.stabilize")}
          </button>
        </div>
      </OperationDialog>
    );
  }

  if (dialog === "divide") {
    return (
      <OperationDialog
        title={t("cell.divideTitle")}
        description={t("cell.divideDescription", { cell: selectedCellId })}
        onClose={onClose}
        busy={activeOperation === "divide"}
      >
        <form onSubmit={onConfirmDivide}>
          <ReadOnlyCellField label={t("cell.parentCell")} value={selectedCellId} />
          <label className="field-label" htmlFor="divide-child-cell-id">
            {t("cell.childCellId")}
          </label>
          <input
            id="divide-child-cell-id"
            className="text-input"
            value={childCellId}
            onChange={(event) => onChangeChildCellId(event.target.value)}
            autoFocus
            disabled={Boolean(activeOperation)}
            autoComplete="off"
          />
          <OperationProgress operation={operationProgress} t={t} />
          <DialogError error={error} />
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={Boolean(activeOperation)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!childCellId.trim() || Boolean(activeOperation)}
            >
              {t(activeOperation === "divide" ? "cell.dividing" : "cell.divide")}
            </button>
          </div>
        </form>
      </OperationDialog>
    );
  }

  if (dialog !== "fuse") {
    return null;
  }

  const parentCellIds = [selectedCellId, ...selectedFuseCellIds];

  return (
    <OperationDialog
      title={t("cell.fuseTitle")}
      description={t("cell.fuseDescription")}
      onClose={onClose}
      busy={activeOperation === "fuse"}
    >
      <form onSubmit={onConfirmFuse}>
        <div className="cell-operation-dialog__parents">
          <span>{t("cell.parents")}</span>
          <div>
            {parentCellIds.map((cellId) => (
              <code key={cellId}>{cellId}</code>
            ))}
          </div>
        </div>
        <label className="field-label" htmlFor="fuse-child-cell-id">
          {t("cell.childCellId")}
        </label>
        <input
          id="fuse-child-cell-id"
          className="text-input"
          value={childCellId}
          onChange={(event) => onChangeChildCellId(event.target.value)}
          autoFocus
          disabled={Boolean(activeOperation)}
          autoComplete="off"
        />
        <OperationProgress operation={operationProgress} t={t} />
        <DialogError error={error} />
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onBackToFuseSelection}
            disabled={Boolean(activeOperation)}
          >
            {t("common.back")}
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={!childCellId.trim() || Boolean(activeOperation)}
          >
            {t(activeOperation === "fuse" ? "cell.fusing" : "cell.fuse")}
          </button>
        </div>
      </form>
    </OperationDialog>
  );
}

function OperationProgress({ operation, t }) {
  if (!operation || ["completed", "failed", "cancelled"].includes(operation.status)) {
    return null;
  }

  const progress = Math.max(0, Math.min(100, Number(operation.progress) || 0));
  const stage = String(operation.currentStage ?? operation.status ?? "working")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <div className="cell-operation-progress" aria-live="polite">
      <div className="cell-operation-progress__label">
        <span>{translateOperationStage(stage, t)}</span>
        <strong>{progress}%</strong>
      </div>
      <div
        className="cell-operation-progress__track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function OperationDialog({ title, description, onClose, busy, children }) {
  const { t } = useUiPreferences();
  return (
    <div
      className="modal-backdrop cell-operation-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        className="create-cell-dialog cell-operation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-operation-dialog-title"
      >
        <div className="dialog-header">
          <div>
            <h2 id="cell-operation-dialog-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            type="button"
            className="dialog-close-button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function translateOperationStage(stage, t) {
  const key = {
    Working: "cell.stageWorking",
    Pending: "cell.stagePending",
    Accepted: "incubator.phaseAccepted",
    Validating: "incubator.phaseValidating",
    Stabilizing: "incubator.phaseStabilizing",
    Dividing: "cell.dividing",
    Fusing: "cell.fusing",
  }[stage];
  return key ? t(key) : stage;
}

function ReadOnlyCellField({ label, value }) {
  return (
    <div className="cell-operation-dialog__readonly">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DialogError({ error }) {
  return error ? <div className="dialog-error">{error}</div> : null;
}
