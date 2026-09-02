const PHASE_LABELS = Object.freeze({
  accepted: "Accepted",
  analyzing: "Analyzing stimulus",
  selecting: "Finding the right Cell",
  stimulating: "Stimulating",
  cultivating: "Cultivating",
  evolving: "Evolving Artifact",
  validating: "Validating",
  stabilizing: "Stabilizing",
  stable: "Stable",
  needs_attention: "Needs Attention",
  failed: "Needs Attention",
});

export function toCultivationViewModel(operation, selectedCell = null) {
  if (!operation) return null;

  const failed = operation.status === "failed";
  const lifeState = failed
    ? "needs_attention"
    : operation.lifeState ?? (operation.status === "completed" ? "stable" : "growing");
  const phase = String(operation.currentStage ?? "accepted").toLowerCase();
  const cellIds = operation.context?.cellIds ?? [];
  const selectedId = selectedCell?.id ?? selectedCell?.cellId;
  const selectedMatchesOperation = selectedId && cellIds.includes(selectedId);
  const selectedLabel = selectedMatchesOperation
    ? selectedCell?.name ?? selectedId
    : null;
  const attentionMessage = lifeState === "needs_attention"
    ? humanizeAttentionMessage(
        operation.error?.message ??
        operation.attention?.message ??
        (selectedMatchesOperation ? selectedCell?.cultivation?.attention?.message : null) ??
        operation.result?.cells?.find((cell) => cell.cellId === (selectedId ?? cellIds[0]))
          ?.qualityDecision?.gates?.find((gate) => gate.outcome !== "sufficient")?.actual
      )
    : null;

  return {
    operationId: operation.operationId,
    status: lifeState === "needs_attention"
      ? "Needs Attention"
      : lifeState === "stable"
        ? "Stable"
        : "Growing",
    tone: lifeState === "needs_attention"
      ? "attention"
      : lifeState === "stable"
        ? "stable"
        : "growing",
    progress: clampProgress(operation.progress),
    phaseLabel: PHASE_LABELS[phase] ?? "Growing",
    cellLabel: selectedLabel ?? (cellIds.length === 1 ? cellIds[0] : "Cradle"),
    sourceName: operation.source?.originalName ?? operation.context?.sourceName ?? null,
    attentionMessage,
  };
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function humanizeAttentionMessage(message) {
  const value = String(message ?? "").trim();
  if (/spawn\s+codex\s+ENOENT|unable to start codex cli/i.test(value)) {
    return "The Codex provider is unavailable. Check the provider installation and retry.";
  }
  if (/OCR|machine-readable text|extraction evidence/i.test(value)) {
    return "This source needs text extraction or OCR before Cradle can cultivate it safely.";
  }
  return value || "Cradle needs a decision or additional evidence before it can continue.";
}
