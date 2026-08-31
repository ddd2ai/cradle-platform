import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createArtifactChangePlan,
} from "../src/production/artifact-change-plan.js";
import {
  ArtifactChangePlanMutationService,
} from "../src/production/artifact-change-plan-mutation-service.js";
import { ArtifactIncrementalValidator } from "../src/production/artifact-incremental-validator.js";
import { ArtifactMutationCoordinator } from "../src/production/artifact-mutation-coordinator.js";
import { ArtifactStore } from "../src/production/artifact-store.js";
import { ArtifactValidator } from "../src/production/artifact-validator.js";

const root = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-change-plan-mutation-")
);

try {
  const setupStore = new ArtifactStore({ productionsDir: root });
  await setupStore.saveArtifact({
    id: "artifact-merge-non-overlap",
    type: "generic",
    title: "Concurrent non-overlapping changes",
    goal: "Maintain independent outputs",
    outputs: [
      { kind: "file", path: "a.txt", language: "text", content: "a-0" },
      { kind: "file", path: "b.txt", language: "text", content: "b-0" },
    ],
    notes: [],
  });
  const base = await setupStore.readArtifact("artifact-merge-non-overlap");
  const planA = createPlan({
    artifact: base,
    outputPath: "a.txt",
    before: "a-0",
    after: "a-1",
    revisionId: "rev-merge-a",
  });
  const planB = createPlan({
    artifact: base,
    outputPath: "b.txt",
    before: "b-0",
    after: "b-1",
    revisionId: "rev-merge-b",
  });
  const writerA = createWriter(root);
  const writerB = createWriter(root);
  const merged = await Promise.all([
    writerA.apply(planA),
    writerB.apply(planB),
  ]);
  assert.equal(merged.filter((result) => result.rebased).length, 1);
  assert.equal(merged.every((result) => result.saved.storageMode === "delta"), true);
  const mergedArtifact = await setupStore.readArtifact("artifact-merge-non-overlap");
  assert.equal(outputContent(mergedArtifact, "a.txt"), "a-1");
  assert.equal(outputContent(mergedArtifact, "b.txt"), "b-1");

  await setupStore.saveArtifact({
    id: "artifact-reject-overlap",
    type: "generic",
    title: "Concurrent overlapping changes",
    goal: "Reject conflicting output changes",
    outputs: [
      { kind: "file", path: "value.txt", language: "text", content: "value-0" },
    ],
    notes: [],
  });
  const overlappingBase = await setupStore.readArtifact("artifact-reject-overlap");
  const overlapping = await Promise.allSettled([
    createWriter(root).apply(createPlan({
      artifact: overlappingBase,
      outputPath: "value.txt",
      before: "value-0",
      after: "value-a",
      revisionId: "rev-overlap-a",
    })),
    createWriter(root).apply(createPlan({
      artifact: overlappingBase,
      outputPath: "value.txt",
      before: "value-0",
      after: "value-b",
      revisionId: "rev-overlap-b",
    })),
  ]);
  assert.equal(
    overlapping.filter((result) => result.status === "fulfilled").length,
    1
  );
  assert.equal(
    overlapping.filter((result) => result.status === "rejected").length,
    1
  );
  assert.match(
    overlapping.find((result) => result.status === "rejected").reason.message,
    /content hash is stale/
  );
  const overlapContent = outputContent(
    await setupStore.readArtifact("artifact-reject-overlap"),
    "value.txt"
  );
  assert.equal(["value-a", "value-b"].includes(overlapContent), true);

  await setupStore.saveArtifact({
    id: "artifact-preserve-goal",
    type: "generic",
    title: "Preserve aggregate goal fidelity",
    goal: "包含 run 方法",
    outputs: [
      { kind: "file", path: "a.txt", language: "text", content: "run-a" },
      { kind: "file", path: "b.txt", language: "text", content: "run-b" },
    ],
    notes: [],
  });
  const goalBase = await setupStore.readArtifact("artifact-preserve-goal");
  const goalResults = await Promise.allSettled([
    createWriter(root).apply(createPlan({
      artifact: goalBase,
      outputPath: "a.txt",
      before: "run-a",
      after: "removed-a",
      revisionId: "rev-goal-a",
    })),
    createWriter(root).apply(createPlan({
      artifact: goalBase,
      outputPath: "b.txt",
      before: "run-b",
      after: "removed-b",
      revisionId: "rev-goal-b",
    })),
  ]);
  assert.equal(
    goalResults.filter((result) => result.status === "fulfilled").length,
    1,
    JSON.stringify(goalResults.map((result) => result.status === "fulfilled"
      ? {
          status: result.status,
          storageMode: result.value.saved.storageMode,
          validation: result.value.validation,
          rebased: result.value.rebased,
          baseMode: result.value.baseMode,
        }
      : { status: result.status, error: result.reason.message }))
  );
  assert.equal(
    goalResults.filter((result) => result.status === "rejected").length,
    1
  );
  const goalArtifact = await setupStore.readArtifact("artifact-preserve-goal");
  assert.equal(
    goalArtifact.outputs.filter((output) => output.content.includes("run")).length,
    1
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("Artifact change-plan mutation service tests passed");

function createWriter(productionsDir) {
  const validator = new ArtifactValidator();
  return new ArtifactChangePlanMutationService({
    store: new ArtifactStore({
      productionsDir,
      mutationCoordinator: new ArtifactMutationCoordinator(),
    }),
    validator,
    incrementalValidator: new ArtifactIncrementalValidator({ validator }),
  });
}

function createPlan({ artifact, outputPath, before, after, revisionId }) {
  return createArtifactChangePlan({
    artifact,
    allowedPaths: [outputPath],
    proposal: {
      summary: `Change ${outputPath}`,
      changes: [{
        path: outputPath,
        replacements: [{ before, after }],
      }],
    },
    revisionIdFactory: () => revisionId,
  });
}

function outputContent(artifact, outputPath) {
  return artifact.outputs.find((output) => output.path === outputPath).content;
}
