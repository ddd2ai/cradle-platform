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
} = {}) {
  const now = new Date().toISOString();

  return {
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
}
