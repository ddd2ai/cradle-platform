export const STIMULUS_CULTIVATION_CONTRACT = Object.freeze({
  contractId: "stimulus-cultivation",
  version: 1,
  requiredGates: [
    "source_integrity",
    "content_evidence",
    "cell_relevance",
    "memory_recorded",
    "artifact_integrity",
    "provenance_recorded",
  ],
});

export function decideCultivationQuality(observations = []) {
  const byIndicator = new Map(observations.map((item) => [item.indicator, item]));
  const gates = STIMULUS_CULTIVATION_CONTRACT.requiredGates.map((indicator) =>
    byIndicator.get(indicator) ?? observation({
      indicator,
      outcome: "insufficient_evidence",
      expected: "gate observed",
      actual: "missing",
      evidenceRef: null,
    })
  );
  const error = gates.find((gate) => gate.outcome === "error");
  const insufficient = gates.find((gate) => gate.outcome === "insufficient");
  const missing = gates.find((gate) => gate.outcome === "insufficient_evidence");
  const outcome = error
    ? "error"
    : insufficient
      ? "insufficient"
      : missing
        ? "insufficient_evidence"
        : "sufficient";
  return {
    contract: STIMULUS_CULTIVATION_CONTRACT,
    outcome,
    lifeState: outcome === "sufficient" ? "stable" : "needs_attention",
    gates,
  };
}

export function observation({
  indicator,
  outcome,
  method,
  expected,
  actual,
  evidenceRef,
  observedAt = new Date().toISOString(),
}) {
  return { indicator, outcome, method, expected, actual, evidenceRef, observedAt };
}
