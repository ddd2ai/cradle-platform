export function evaluateEvolutionSignificance({ thoughts = [], evidence = [], force = false } = {}) {
  if (thoughts.length === 0) {
    return { eligible: false, reason: "no unevolved thoughts", evidenceIds: [] };
  }
  if (force) {
    return {
      eligible: true,
      reason: "forced evolution",
      evidenceIds: evidence.map((item) => item.evidenceId),
    };
  }

  const admissible = evidence.filter(
    (item) => Number(item.confidence ?? 0) >= 0.6 && Number(item.stateImpact ?? 0) >= 0.5
  );
  const critical = admissible.find(
    (item) => Number(item.stateImpact) >= 0.8 && Number(item.risk ?? 0) >= 0.7 &&
      Number(item.confidence) >= 0.8
  );
  if (critical) {
    return {
      eligible: true,
      reason: "critical state-impact evidence",
      evidenceIds: [critical.evidenceId],
    };
  }

  const distinctCauses = new Map();
  for (const item of admissible) {
    distinctCauses.set(item.causationId ?? item.dedupKey ?? item.evidenceId, item);
  }
  if (distinctCauses.size >= 2) {
    return {
      eligible: true,
      reason: "persistent state-impact evidence",
      evidenceIds: [...distinctCauses.values()].map((item) => item.evidenceId),
    };
  }

  return {
    eligible: false,
    reason: evidence.length === 0
      ? "no significant evidence"
      : "evidence does not meet impact, confidence, or persistence gates",
    evidenceIds: [],
  };
}

export function stimuliToEvolutionEvidence(stimuli = []) {
  return stimuli.map((stimulus) => {
    const envelope = stimulus.envelope ?? {};
    const salience = envelope.salience ?? {};
    const facts = envelope.facts ?? {};
    return {
      evidenceId: envelope.stimulusId ?? `${stimulus.category}:${stimulus.file}`,
      type: envelope.type ?? `${stimulus.category}.legacy`,
      source: envelope.source ?? "legacy.markdown",
      causationId: envelope.causationId ?? null,
      dedupKey: envelope.dedupKey ?? `${stimulus.category}:${stimulus.file}`,
      observedAt: envelope.createdAt ?? new Date().toISOString(),
      risk: Number(salience.risk ?? (stimulus.category === "threats" ? 0.9 : 0.1)),
      stateImpact: Number(
        salience.stateImpact ?? (stimulus.category === "threats" ? 0.8 : 0.3)
      ),
      novelty: Number(salience.novelty ?? 0.5),
      confidence: envelope.source === "internal.execution"
        ? 1
        : Object.values(facts).some((value) => value != null) ? 0.8 : 0.5,
    };
  });
}
