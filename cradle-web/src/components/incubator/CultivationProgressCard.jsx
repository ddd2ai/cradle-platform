import { useEffect, useState } from "react";
import { toCultivationViewModel } from "../../domain/cultivationViewModel";
import { formatElapsed } from "../../domain/cultivationElapsed";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

const STABLE_CONFIRMATION_MS = 2800;

export function CultivationProgressCard({
  operationId,
  acceptedOperation,
  selectedCell,
  onDismiss,
}) {
  const { t } = useUiPreferences();
  const streamedOperation = useOperationProgress(operationId);
  const operation = streamedOperation ?? acceptedOperation;
  const view = toCultivationViewModel(operation, selectedCell);
  const elapsed = useElapsedTime(operation);

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
        <span>{symbol} {translateProgressStatus(view.status, t)}</span>
      </div>
      {view.tone === "growing" ? (
        <>
          <div
            className="cultivation-progress__track"
            role="progressbar"
            aria-label={t("incubator.cellCultivation", { cell: view.cellLabel })}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={view.progress}
            aria-valuetext={`${translateProgressPhase(view.phaseLabel, t)} · ${t("incubator.elapsed", { time: elapsed })}`}
          >
            <span style={{ width: `${view.progress}%` }} />
          </div>
          <div className="cultivation-progress__meta">
            <span>{translateProgressPhase(view.phaseLabel, t)} · {t("incubator.elapsed", { time: elapsed })}</span>
            {view.sourceName ? <span title={view.sourceName}>{view.sourceName}</span> : null}
          </div>
        </>
      ) : (
        <>
          <p className="cultivation-progress__terminal-message">
            {view.tone === "attention"
              ? translateAttentionMessage(view.attentionMessage, t)
              : view.artifact?.artifactId
                ? t("incubator.artifactCreated", { id: view.artifact.artifactId })
                : t("incubator.complete")}
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

function useElapsedTime(operation) {
  const terminal = ["completed", "failed"].includes(operation?.status);
  const startedAt = operation?.startedAt ?? operation?.createdAt;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt || terminal) return undefined;
    const intervalId = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(intervalId);
  }, [startedAt, terminal]);

  const endAt = terminal
    ? operation.completedAt ?? operation.failedAt ?? operation.updatedAt
    : null;
  return formatElapsed(startedAt, endAt);
}

function translateProgressStatus(value, t) {
  return ({
    "Needs Attention": t("status.needsAttention"),
    Stable: t("status.stable"),
    Growing: t("observatory.growing"),
  })[value] ?? value;
}

function translateProgressPhase(value, t) {
  const keys = {
    Accepted: "incubator.phaseAccepted",
    "Analyzing stimulus": "incubator.phaseAnalyzing",
    "Finding the right Cell": "incubator.phaseSelecting",
    Stimulating: "incubator.phaseStimulating",
    Cultivating: "incubator.phaseCultivating",
    "Forming next growth": "incubator.phasePlanning",
    "Producing Artifact": "incubator.phaseProducing",
    "Evolving Artifact": "incubator.phaseEvolving",
    Validating: "incubator.phaseValidating",
    Stabilizing: "incubator.phaseStabilizing",
    Stable: "status.stable",
    "Needs Attention": "status.needsAttention",
    Growing: "observatory.growing",
  };
  return keys[value] ? t(keys[value]) : value;
}

function translateAttentionMessage(value, t) {
  const messages = {
    "The Codex provider is unavailable. Check the provider installation and retry.": "incubator.codexUnavailable",
    "This source needs text extraction or OCR before Cradle can cultivate it safely.": "incubator.ocrRequired",
    "Cradle needs a decision or additional evidence before it can continue.": "incubator.moreEvidence",
  };
  return messages[value] ? t(messages[value]) : value;
}
