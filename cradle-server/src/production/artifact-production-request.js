import {
  assertSupportedArtifactType,
  normalizeArtifactType,
} from "./artifact-type-catalog.js";

export function resolveArtifactProductionRequest({
  artifactType = null,
  text = "",
  sourceName = "",
} = {}) {
  const requestedType = normalizeArtifactType(artifactType);
  if (requestedType) {
    return productionRequest({
      type: assertSupportedArtifactType(requestedType),
      goal: text,
      sourceName,
      mode: "metadata",
    });
  }

  const directive = parseProduceDirective(text);
  if (directive) {
    return productionRequest({
      type: assertSupportedArtifactType(directive.type),
      goal: directive.goal,
      sourceName,
      mode: "directive",
    });
  }

  return {
    decision: "observe",
    reason: "No explicit Artifact type was supplied",
  };
}

export function parseProduceDirective(text) {
  const match = String(text ?? "").match(/^\s*\/produce\s+(\S+)\s+([\s\S]+?)\s*$/u);
  if (!match) return null;
  return {
    type: normalizeArtifactType(match[1]),
    goal: match[2].trim(),
  };
}

function productionRequest({ type, goal, sourceName, mode }) {
  const normalizedGoal = String(goal ?? "").trim();
  if (!normalizedGoal) {
    const error = new Error("Artifact production requires a Goal");
    error.code = "ARTIFACT_GOAL_REQUIRED";
    throw error;
  }
  return {
    decision: "create",
    type,
    goal: normalizedGoal.slice(0, 20_000),
    title: productionTitle(normalizedGoal, sourceName),
    mode,
    reason: `Explicit ${type} production request`,
  };
}

function productionTitle(goal, sourceName) {
  const firstLine = goal.split(/[。！？!?\n]/u, 1)[0]?.trim();
  return (firstLine || String(sourceName ?? "").trim() || "Cultivated Artifact").slice(0, 80);
}
