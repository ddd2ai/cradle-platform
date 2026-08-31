const PASSIVE_EXECUTION_STATUSES = new Set(["passed", "skipped"]);

export function evaluateStimulusBatch(stimuli = []) {
  const executionResults = stimuli.map(readExecutionResult);
  const isPassiveExecutionBatch =
    executionResults.length > 0 &&
    executionResults.every(
      (result) => result?.source === "internal.execution" &&
        PASSIVE_EXECUTION_STATUSES.has(result.status)
    );

  if (!isPassiveExecutionBatch) {
    return {
      processing: "reasoning",
      reason: "stimulus may change cell state or decisions",
    };
  }

  return {
    processing: "summary-only",
    reason: "successful execution evidence is deterministic",
    observation: {
      summary: `${executionResults.length} artifact execution result(s) completed without an actionable failure.`,
      facts: executionResults.map(
        (result) => `${result.artifactId ?? "artifact"}: ${result.status}`
      ),
      interpretations: [],
      hypotheses: [],
      unknowns: [],
      nextActions: [],
    },
  };
}

function readExecutionResult(stimulus) {
  const envelope = stimulus?.envelope;
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
