import assert from "node:assert/strict";
import {
  ArtifactMutationCoordinator,
} from "../src/production/artifact-mutation-coordinator.js";

const coordinator = new ArtifactMutationCoordinator();
let sameArtifactActive = 0;
let maxSameArtifactActive = 0;
const order = [];
await Promise.all([1, 2, 3].map((value) =>
  coordinator.runExclusive("artifact-a", async () => {
    sameArtifactActive += 1;
    maxSameArtifactActive = Math.max(maxSameArtifactActive, sameArtifactActive);
    order.push(value);
    await new Promise((resolve) => setTimeout(resolve, 2));
    sameArtifactActive -= 1;
  })
));
assert.equal(maxSameArtifactActive, 1);
assert.deepEqual(order, [1, 2, 3]);

let releaseFirst;
const firstGate = new Promise((resolve) => {
  releaseFirst = resolve;
});
let parallelArtifactsActive = 0;
let maxParallelArtifactsActive = 0;
const first = coordinator.runExclusive("artifact-a", async () => {
  parallelArtifactsActive += 1;
  maxParallelArtifactsActive = Math.max(
    maxParallelArtifactsActive,
    parallelArtifactsActive
  );
  await firstGate;
  parallelArtifactsActive -= 1;
});
const second = coordinator.runExclusive("artifact-b", async () => {
  parallelArtifactsActive += 1;
  maxParallelArtifactsActive = Math.max(
    maxParallelArtifactsActive,
    parallelArtifactsActive
  );
  releaseFirst();
  parallelArtifactsActive -= 1;
});
await Promise.all([first, second]);
assert.equal(maxParallelArtifactsActive, 2);

console.log("Artifact mutation coordinator tests passed");
