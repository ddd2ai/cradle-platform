import { normalizeStimulusEnvelope } from "./stimulus-envelope.js";

export function legacyStimulusToEnvelope(stimulus, options = {}) {
  const content = String(stimulus?.content ?? "");
  const status = readSection(content, "Status")?.toLowerCase() ?? null;
  const targetCellId = readSection(content, "Cell");
  const source = readSection(content, "Source") ?? "legacy.markdown";
  const artifactId = readSection(content, "Artifact");
  const executionId = readSection(content, "Execution");

  return normalizeStimulusEnvelope({
    stimulusId: stimulus.stimulusId,
    type: source === "internal.execution" ? `artifact.execution.${status ?? "unknown"}` : undefined,
    category: stimulus.category,
    source,
    targetCellIds: targetCellId ? [targetCellId] : [],
    causationId: executionId,
    dedupKey: stimulus.dedupKey ?? `${stimulus.category}:${stimulus.file}`,
    createdAt: stimulus.createdAt,
    summary: readSection(content, "Summary") ?? stimulus.file ?? "legacy stimulus",
    facts: { artifactId, executionId, status },
    content,
  }, options);
}

function readSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.match(new RegExp(`^## ${escaped}\\s*\\n+([^\\n]+)$`, "m"))?.[1]?.trim() ?? null;
}
