export const DEFAULT_MAX_DELTA_DEPTH = 32;
export const DEFAULT_MAX_DELTA_METADATA_BYTES = 1024 * 1024;

export function evaluateArtifactRevisionCompaction({
  deltaDepth,
  deltaMetadataBytes,
  maxDeltaDepth = DEFAULT_MAX_DELTA_DEPTH,
  maxDeltaMetadataBytes = DEFAULT_MAX_DELTA_METADATA_BYTES,
} = {}) {
  if (
    !Number.isSafeInteger(deltaDepth) ||
    deltaDepth < 0 ||
    !Number.isSafeInteger(deltaMetadataBytes) ||
    deltaMetadataBytes < 0
  ) {
    return { shouldCompact: true, reason: "pointer-metadata-unavailable" };
  }
  if (deltaDepth >= maxDeltaDepth) {
    return { shouldCompact: true, reason: "delta-depth-limit" };
  }
  if (deltaMetadataBytes >= maxDeltaMetadataBytes) {
    return { shouldCompact: true, reason: "delta-bytes-limit" };
  }
  return { shouldCompact: false, reason: "below-threshold" };
}
