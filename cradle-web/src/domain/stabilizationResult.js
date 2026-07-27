export function formatStabilizeMessage(cellId, result) {
  const artifactId =
    result?.diagnosis?.artifactId ??
    result?.execution?.result?.artifactId;

  if (result?.patched) {
    return artifactId
      ? `Cell ${cellId} repaired ${artifactId} and verified stable.`
      : `Cell ${cellId} repaired and verified stable.`;
  }

  if (result?.diagnosed) {
    return `Cell ${cellId} checked — no repair was required.`;
  }

  return `Cell ${cellId} stabilization completed.`;
}
