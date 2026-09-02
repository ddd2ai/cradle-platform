export function buildObservatoryModel(cells) {
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
  return {
    cells: mapped,
    attention,
    attentionCount: mapped.filter((cell) => cell.needsAttention).length,
    stableCount: mapped.filter((cell) => cell.stable).length,
    growingCount: mapped.filter((cell) => cell.growing).length,
    insufficientCount: mapped.filter((cell) => cell.insufficient).length,
  };
}

function humanize(value) {
  return String(value).toLowerCase().replaceAll("_", " ");
}

function clamp01(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}
