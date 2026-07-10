export const ARTIFACT_TYPES = [
  "code",
  "document",
  "diagram",
  "sql",
  "config",
  "test",
  "prompt",
  "decision",
  "research",
  "spec",
  "task",
  "generic",
];

export const ARTIFACT_STATUSES = [
  "draft",
  "reviewed",
  "revised",
  "published",
  "rejected",
];

export function createArtifact({
  id,
  type = "generic",
  title,
  goal,
  cellId,
  provider,
  model,
  plan = null,
  outputs = [],
  notes = [],
  origin = null,
} = {}) {
  const now = new Date().toISOString();

  const artifact = {
    id,
    type,
    title: title || goal || "Untitled Artifact",
    status: "draft",

    goal,

    context: {
      cellId,
      provider,
      model,
    },

    plan,
    outputs,
    notes,

    review: {
      status: "pending",
      notes: [],
    },

    createdAt: now,
    updatedAt: now,
  };

  // 加入 origin 資訊（可選）
  if (origin) {
    artifact.origin = {
      mode: origin.mode || "created",
      sourceCellIds: Array.isArray(origin.sourceCellIds) ? origin.sourceCellIds : [],
      sourceArtifactIds: Array.isArray(origin.sourceArtifactIds) ? origin.sourceArtifactIds : [],
      sourceArtifactRefs: Array.isArray(origin.sourceArtifactRefs) ? origin.sourceArtifactRefs : [],
      livingContextId: origin.livingContextId || null
    };
  }

  return artifact;
}
