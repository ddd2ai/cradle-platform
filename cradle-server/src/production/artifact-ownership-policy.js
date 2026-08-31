export const ARTIFACT_OWNER_VIOLATION = "ARTIFACT_OWNER_VIOLATION";

export class ArtifactOwnerViolationError extends Error {
  constructor({ artifactId, expectedOwnerCellId, actualOwnerCellIds, actorCellId } = {}) {
    const actual = [...new Set(actualOwnerCellIds ?? [])].filter(Boolean);
    const reason = actorCellId && expectedOwnerCellId && actorCellId !== expectedOwnerCellId
      ? `actor ${actorCellId} is not owner ${expectedOwnerCellId}`
      : `expected owner ${expectedOwnerCellId ?? "(unspecified)"}, found ${actual.join(", ") || "(unowned)"}`;
    super(`Artifact ownership violation for ${artifactId ?? "(unknown)"}: ${reason}`);
    this.name = "ArtifactOwnerViolationError";
    this.code = ARTIFACT_OWNER_VIOLATION;
    this.artifactId = artifactId ?? null;
    this.expectedOwnerCellId = expectedOwnerCellId ?? null;
    this.actualOwnerCellIds = actual;
    this.actorCellId = actorCellId ?? null;
  }
}

export function resolveArtifactOwnerCellId(artifact) {
  const owners = declaredArtifactOwnerCellIds(artifact);
  if (owners.length > 1) {
    throw new ArtifactOwnerViolationError({
      artifactId: artifact?.id,
      expectedOwnerCellId: artifact?.ownerCellId ?? null,
      actualOwnerCellIds: owners,
    });
  }
  return owners[0] ?? null;
}

export function bindArtifactOwner(artifact, ownerCellId) {
  if (!artifact?.id) {
    throw new Error("bindArtifactOwner requires artifact.id");
  }
  if (!ownerCellId) {
    resolveArtifactOwnerCellId(artifact);
    return artifact;
  }

  const actualOwnerCellId = resolveArtifactOwnerCellId(artifact);
  if (actualOwnerCellId && actualOwnerCellId !== ownerCellId) {
    throw new ArtifactOwnerViolationError({
      artifactId: artifact.id,
      expectedOwnerCellId: ownerCellId,
      actualOwnerCellIds: [actualOwnerCellId],
    });
  }
  if (artifact.ownerCellId === ownerCellId) return artifact;
  return { ...artifact, ownerCellId };
}

export function assertArtifactMutationActor({
  artifact,
  actorCellId,
  expectedOwnerCellId,
} = {}) {
  const actualOwnerCellId = resolveArtifactOwnerCellId(artifact);
  const ownerCellId = expectedOwnerCellId ?? actualOwnerCellId;
  if (
    (expectedOwnerCellId && actualOwnerCellId &&
      actualOwnerCellId !== expectedOwnerCellId) ||
    (actorCellId && ownerCellId && actorCellId !== ownerCellId)
  ) {
    throw new ArtifactOwnerViolationError({
      artifactId: artifact?.id,
      expectedOwnerCellId: ownerCellId,
      actualOwnerCellIds: actualOwnerCellId ? [actualOwnerCellId] : [],
      actorCellId,
    });
  }
  return ownerCellId;
}

function declaredArtifactOwnerCellIds(artifact) {
  return [...new Set([
    artifact?.ownerCellId,
    artifact?.context?.cellId,
    artifact?.origin?.targetCellId,
  ].filter(Boolean))];
}
