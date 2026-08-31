const PASSIVE_EXECUTION_STATUSES = new Set(["passed", "skipped"]);

export function evaluateStimulusAdmission(stimulus) {
  const result = readExecutionResult(stimulus);
  if (
    result?.source === "internal.execution" &&
    PASSIVE_EXECUTION_STATUSES.has(result.status)
  ) {
    return {
      decision: "summary-only",
      activate: false,
      reason: "successful execution evidence can be aggregated deterministically",
    };
  }

  return {
    decision: "activate",
    activate: true,
    reason: "stimulus may change cell state or decisions",
  };
}

export function evaluateStimulusBatch(stimuli = []) {
  const summaryStimuli = [];
  const reasoningStimuli = [];
  for (const stimulus of stimuli) {
    const admission = evaluateStimulusAdmission(stimulus);
    (admission.activate ? reasoningStimuli : summaryStimuli).push(stimulus);
  }

  if (reasoningStimuli.length > 0) {
    return {
      processing: "reasoning",
      reason: "stimulus may change cell state or decisions",
      summaryStimuli,
      reasoningStimuli,
      summaryObservation: createPassiveExecutionObservation(summaryStimuli),
    };
  }

  return {
    processing: "summary-only",
    reason: "successful execution evidence is deterministic",
    summaryStimuli,
    reasoningStimuli,
    observation: createPassiveExecutionObservation(summaryStimuli),
  };
}

function createPassiveExecutionObservation(stimuli) {
  if (stimuli.length === 0) return null;
  const executionResults = stimuli.map(readExecutionResult);
  return {
    summary: `${executionResults.length} artifact execution result(s) completed without an actionable failure.`,
    facts: executionResults.map(
      (result) => `${result.artifactId ?? "artifact"}: ${result.status}`
    ),
    interpretations: [],
    hypotheses: [],
    unknowns: [],
    nextActions: [],
  };
}

function readExecutionResult(stimulus) {
  const envelope = stimulus?.envelope ?? (
    stimulus?.schemaVersion && stimulus?.stimulusId ? stimulus : null
  );
  if (envelope) {
    return {
      source: envelope.source,
      artifactId: envelope.facts?.artifactId,
      status: envelope.facts?.status?.toLowerCase(),
    };
  }
  const content = String(stimulus?.content ?? "");
  return {
    source: readSection(content, "Source"),
    artifactId: readSection(content, "Artifact"),
    status: readSection(content, "Status")?.toLowerCase(),
  };
}

function readSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.match(new RegExp(`^## ${escaped}\\s*\\n+([^\\n]+)$`, "m"))?.[1]?.trim() ?? null;
}
