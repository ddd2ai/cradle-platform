import assert from "node:assert/strict";
import {
  evaluateArtifactRevisionCompaction,
} from "../src/production/artifact-revision-compaction-policy.js";

assert.deepEqual(
  evaluateArtifactRevisionCompaction({
    deltaDepth: 2,
    deltaMetadataBytes: 2048,
  }),
  { shouldCompact: false, reason: "below-threshold" }
);
assert.deepEqual(
  evaluateArtifactRevisionCompaction({
    deltaDepth: 32,
    deltaMetadataBytes: 2048,
  }),
  { shouldCompact: true, reason: "delta-depth-limit" }
);
assert.deepEqual(
  evaluateArtifactRevisionCompaction({
    deltaDepth: 2,
    deltaMetadataBytes: 1024 * 1024,
  }),
  { shouldCompact: true, reason: "delta-bytes-limit" }
);
assert.deepEqual(
  evaluateArtifactRevisionCompaction({
    deltaDepth: null,
    deltaMetadataBytes: null,
  }),
  { shouldCompact: true, reason: "pointer-metadata-unavailable" }
);

console.log("Artifact revision compaction policy tests passed");
