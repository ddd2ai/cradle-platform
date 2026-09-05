export function buildObservatoryModel(cells, operations = []) {
  const mapped = cells.map((cell) => {
    const state = String(cell.cultivation?.state ?? "").toLowerCase();
    const sampleSize = Number(cell.maturity?.sampleSize ?? 0);
    const insufficient = sampleSize < 2;
    const needsAttention = state === "needs_attention";
    const growing = ["stimulated", "growing"].includes(state);
    const stable = state === "stable";
    const evidence = Array.isArray(cell.cultivation?.evidence)
      ? cell.cultivation.evidence
      : [];
    const latestQualityEvent = [...(cell.lifecycleEvents ?? [])]
      .reverse()
      .find((event) => event?.qualityOutcome);
    return {
      ...cell,
      maturityTrend: cell.dna?.maturityTrend ?? [],
      maturityPercent: insufficient ? null : Number(cell.maturity?.percent ?? 0),
      capability: clamp01(cell.maturity?.normalizedMagnitude),
      stability: insufficient ? null : clamp01(cell.maturity?.convergence),
      sampleSize,
      insufficient,
      needsAttention,
      growing,
      stable,
      evidence,
      qualityOutcome: latestQualityEvent?.qualityOutcome ?? null,
      tone: needsAttention ? "warn" : growing ? "growth" : stable ? "good" : insufficient ? "muted" : "neutral",
      stateLabel: needsAttention ? "Attention" : growing ? "Growing" : stable ? "Stable" : insufficient ? "Insufficient" : humanize(cell.status ?? "Observed"),
    };
  });
  const attention = mapped
    .filter((cell) => cell.needsAttention || cell.insufficient)
    .map((cell) => ({
      cellId: cell.cellId,
      name: cell.name,
      tone: cell.needsAttention ? "warn" : "muted",
      label: cell.needsAttention ? "Review" : "Evidence",
      reason: cell.needsAttention
        ? cell.cultivation?.attention?.message
          ?? cell.evidence.find((gate) => gate.outcome !== "sufficient")?.actual
          ?? "Cultivation reported that intervention is required."
        : `Only ${cell.sampleSize} DNA sample${cell.sampleSize === 1 ? "" : "s"}; maturity cannot be established.`,
    }));

  const mappedByCellId = new Map(mapped.map((cell) => [cell.cellId, cell]));
  const attentionByCellId = new Map(attention.map((item) => [item.cellId, item]));
  const operationAttentionByCell = groupOperationAttentionByCell(operations, mappedByCellId);
  const operationAttention = [...operationAttentionByCell.entries()]
    .filter(([cellId]) => !attentionByCellId.has(cellId))
    .map(([cellId, data]) => ({
      cellId,
      name: data.cell?.name ?? data.name,
      tone: "warn",
      label: "Review",
      reason: data.reason,
    }));

  return {
    cells: mapped,
    attention: [...attention, ...operationAttention],
    attentionCount: mapped.filter((cell) => cell.needsAttention).length + operationAttention.length,
    stableCount: mapped.filter((cell) => cell.stable).length,
    growingCount: mapped.filter((cell) => cell.growing).length,
    insufficientCount: mapped.filter((cell) => cell.insufficient).length,
  };
}

function groupOperationAttentionByCell(operations, cellsById) {
  const selected = new Map();
  const operationList = Array.isArray(operations) ? operations : [];

  for (const operation of operationList) {
    if (operation?.type !== "stimulus-cultivation") continue;
    if (operation?.lifeState !== "needs_attention") continue;
    const candidates = pickOperationCells(operation, cellsById);
    const updatedAt = new Date(operation.updatedAt ?? operation.completedAt ?? operation.createdAt ?? 0).getTime();

    if (candidates.length === 0 && operation.operationId) {
      selected.set(`operation:${operation.operationId}`, {
        name: operation.context?.sourceName ?? "Unrouted stimulus",
        reason: operationReason(operation),
        updatedAt,
      });
      continue;
    }

    for (const candidate of candidates) {
      const current = selected.get(candidate.cellId);
      const operationTime = current?.updatedAt ?? -Infinity;
      if (updatedAt < operationTime) continue;

      selected.set(candidate.cellId, {
        cell: candidate.cell,
        reason: candidate.reason ?? operationReason(operation),
        updatedAt,
      });
    }
  }

  return selected;
}

function operationReason(operation) {
  return operation.error?.message
    ?? operation.attention?.message
    ?? operation.result?.qualityDecision?.reason
    ?? operation.result?.routing?.reason
    ?? "Cultivation reported that intervention is required.";
}

function pickOperationCells(operation, cellsById) {
  const candidates = [];
  const cellIds = [
    ...(Array.isArray(operation?.context?.cellIds) ? operation.context.cellIds : []),
    ...(Array.isArray(operation?.result?.cells)
      ? operation.result.cells.map((record) => record?.cellId)
      : []),
    ...(Array.isArray(operation?.result?.routing?.targets)
      ? operation.result.routing.targets.map((target) => target?.cellId)
      : []),
  ].filter(Boolean);

  for (const cellId of [...new Set(cellIds)]) {
    const cell = cellsById.get(cellId);
    if (!cell) continue;

    const candidate = operation.result?.cells?.find((record) => record.cellId === cellId);
    candidates.push({
      cellId,
      cell,
      reason: candidate?.qualityDecision?.gates
        ?.find((gate) => gate.outcome !== "sufficient")?.actual
        ?? operation.error?.message
        ?? operation.attention?.message
        ?? `Cultivation reported that intervention is required.`,
    });
  }

  return candidates;
}

function humanize(value) {
  return String(value).toLowerCase().replaceAll("_", " ");
}

function clamp01(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}
