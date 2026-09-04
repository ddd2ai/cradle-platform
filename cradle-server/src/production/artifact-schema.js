import { listSupportedArtifactTypes } from "./artifact-type-catalog.js";

export const ARTIFACT_TYPES = [
  ...listSupportedArtifactTypes({ includeLegacy: true }).map((entry) => entry.id),
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
    ownerCellId: cellId,
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
      livingContextId: origin.livingContextId || null,
      ...(origin.producerCellId ? { producerCellId: origin.producerCellId } : {}),
      ...(origin.targetCellId ? { targetCellId: origin.targetCellId } : {}),
      ...(origin.stimulusId ? { stimulusId: origin.stimulusId } : {}),
      ...(origin.sourceId ? { sourceId: origin.sourceId } : {}),
      ...(origin.sourceStimulusId ? { sourceStimulusId: origin.sourceStimulusId } : {}),
      ...(origin.sourceName ? { sourceName: origin.sourceName } : {}),
      ...(origin.sourceMediaType ? { sourceMediaType: origin.sourceMediaType } : {}),
      ...(origin.sourceSha256 ? { sourceSha256: origin.sourceSha256 } : {}),
      ...(origin.observedAt ? { observedAt: origin.observedAt } : {}),
    };
  }

  return artifact;
}
