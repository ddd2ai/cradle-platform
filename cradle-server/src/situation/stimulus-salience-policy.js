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

  const envelope = stimulus?.envelope ?? (
    stimulus?.schemaVersion && stimulus?.stimulusId ? stimulus : null
  );
  if (envelope?.source === "file.ingestion") {
    const decision = envelope.facts?.processing ?? "cultivate";
    return {
      decision,
      activate: decision === "cultivate",
      reason: decision === "summary-only"
        ? "document salience is below the full cultivation threshold"
        : "document has actionable salience",
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
      summaryObservation: createDeterministicSummaryObservation(summaryStimuli),
    };
  }

  return {
    processing: "summary-only",
    reason: "successful execution evidence is deterministic",
    summaryStimuli,
    reasoningStimuli,
    observation: createDeterministicSummaryObservation(summaryStimuli),
  };
}

function createDeterministicSummaryObservation(stimuli) {
  if (stimuli.length === 0) return null;
  const fileStimuli = stimuli.filter((stimulus) => stimulusEnvelope(stimulus)?.source === "file.ingestion");
  const executionResults = stimuli
    .filter((stimulus) => stimulusEnvelope(stimulus)?.source !== "file.ingestion")
    .map(readExecutionResult);
  const facts = [
    ...fileStimuli.map((stimulus) => {
      const envelope = stimulusEnvelope(stimulus);
      return `${envelope.facts?.sourceName ?? envelope.stimulusId}: ${envelope.facts?.extractionOutcome ?? "recorded"}`;
    }),
    ...executionResults.map(
      (result) => `${result.artifactId ?? "artifact"}: ${result.status}`
    ),
  ];
  return {
    summary: fileStimuli.length > 0
      ? `${fileStimuli.length} low-salience document stimulus/stimuli recorded without full cultivation.`
      : `${executionResults.length} artifact execution result(s) completed without an actionable failure.`,
    facts,
    interpretations: [],
    hypotheses: [],
    unknowns: [],
    nextActions: [],
  };
}

function stimulusEnvelope(stimulus) {
  return stimulus?.envelope ?? (
    stimulus?.schemaVersion && stimulus?.stimulusId ? stimulus : null
  );
}

function readExecutionResult(stimulus) {
  const envelope = stimulusEnvelope(stimulus);
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
