import { useEffect } from "react";
import { toCultivationViewModel } from "../../domain/cultivationViewModel";
import { useOperationProgress } from "../../hooks/useOperationProgress";

const STABLE_CONFIRMATION_MS = 2800;

export function CultivationProgressCard({
  operationId,
  acceptedOperation,
  selectedCell,
  onDismiss,
}) {
  const streamedOperation = useOperationProgress(operationId);
  const view = toCultivationViewModel(streamedOperation ?? acceptedOperation, selectedCell);

  useEffect(() => {
    if (view?.tone !== "stable") return undefined;
    const timeoutId = window.setTimeout(
      () => onDismiss?.(view.operationId),
      STABLE_CONFIRMATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, view?.operationId, view?.tone]);

  if (!view) return null;

  const symbol = view.tone === "attention" ? "⚠" : view.tone === "stable" ? "✓" : "🌱";

  return (
    <section className={`cultivation-progress cultivation-progress--${view.tone}`} aria-live="polite">
      <div className="cultivation-progress__heading">
        <strong>{view.cellLabel}</strong>
        <span>{symbol} {view.status}</span>
      </div>
      {view.tone === "growing" ? (
        <>
          <div
            className="cultivation-progress__track"
            role="progressbar"
            aria-label={`${view.cellLabel} cultivation`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={view.progress}
          >
            <span style={{ width: `${view.progress}%` }} />
          </div>
          <div className="cultivation-progress__meta">
            <span>{view.progress}% · {view.phaseLabel}</span>
            {view.sourceName ? <span title={view.sourceName}>{view.sourceName}</span> : null}
          </div>
        </>
      ) : (
        <>
          <p className="cultivation-progress__terminal-message">
            {view.tone === "attention" ? view.attentionMessage : "Cultivation complete."}
          </p>
          {view.sourceName ? (
            <div className="cultivation-progress__meta">
              <span>{view.sourceName}</span>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
