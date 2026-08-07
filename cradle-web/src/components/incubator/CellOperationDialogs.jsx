import { useEffect } from "react";

export function CellOperationDialogs({
  dialog,
  selectedCellId,
  selectedFuseCellIds,
  childCellId,
  activeOperation,
  operationProgress,
  error,
  onChangeChildCellId,
  onClose,
  onBackToFuseSelection,
  onConfirmStabilize,
  onConfirmDivide,
  onConfirmFuse,
}) {
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
        title="Stabilize Cell"
        description={`Diagnose, repair and verify ${selectedCellId}.`}
        onClose={onClose}
        busy={activeOperation === "stabilize"}
      >
        <p className="cell-operation-dialog__note">
          This operation may update the Cell workspace and execute validation.
        </p>
        <OperationProgress operation={operationProgress} />
        <DialogError error={error} />
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={Boolean(activeOperation)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConfirmStabilize}
            disabled={Boolean(activeOperation)}
          >
            {activeOperation === "stabilize" ? "Stabilizing..." : "Stabilize"}
          </button>
        </div>
      </OperationDialog>
    );
  }

  if (dialog === "divide") {
    return (
      <OperationDialog
        title="Divide Cell"
        description={`Create a specialized child from ${selectedCellId}.`}
        onClose={onClose}
        busy={activeOperation === "divide"}
      >
        <form onSubmit={onConfirmDivide}>
          <ReadOnlyCellField label="Parent Cell" value={selectedCellId} />
          <label className="field-label" htmlFor="divide-child-cell-id">
            Child Cell ID
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
          <OperationProgress operation={operationProgress} />
          <DialogError error={error} />
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={Boolean(activeOperation)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!childCellId.trim() || Boolean(activeOperation)}
            >
              {activeOperation === "divide" ? "Dividing..." : "Divide"}
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
      title="Fuse Cells"
      description="Combine selected Cells into a new child."
      onClose={onClose}
      busy={activeOperation === "fuse"}
    >
      <form onSubmit={onConfirmFuse}>
        <div className="cell-operation-dialog__parents">
          <span>Parents</span>
          <div>
            {parentCellIds.map((cellId) => (
              <code key={cellId}>{cellId}</code>
            ))}
          </div>
        </div>
        <label className="field-label" htmlFor="fuse-child-cell-id">
          Child Cell ID
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
        <OperationProgress operation={operationProgress} />
        <DialogError error={error} />
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onBackToFuseSelection}
            disabled={Boolean(activeOperation)}
          >
            Back
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={!childCellId.trim() || Boolean(activeOperation)}
          >
            {activeOperation === "fuse" ? "Fusing..." : "Fuse"}
          </button>
        </div>
      </form>
    </OperationDialog>
  );
}

function OperationProgress({ operation }) {
  if (!operation || ["completed", "failed"].includes(operation.status)) {
    return null;
  }

  const progress = Math.max(0, Math.min(100, Number(operation.progress) || 0));
  const stage = String(operation.currentStage ?? operation.status ?? "working")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <div className="cell-operation-progress" aria-live="polite">
      <div className="cell-operation-progress__label">
        <span>{stage}</span>
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
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
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
