import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArtifactStore } from "../src/production/artifact-store.js";
import {
  applyArtifactChangePlan,
  createArtifactChangePlan,
} from "../src/production/artifact-change-plan.js";
import { evolveArtifactRepairHead } from "../src/production/artifact-impact-index.js";
import {
  ArtifactMutationCoordinator,
} from "../src/production/artifact-mutation-coordinator.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-artifact-revisions-"));
const store = new ArtifactStore({ productionsDir: root });
const artifact = {
  id: "artifact-revisioned",
  type: "generic",
  title: "Revisioned artifact",
  goal: "Keep revisions",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "alpha" },
    { kind: "file", path: "b.txt", language: "text", content: "beta" },
  ],
};

const initialSave = await store.saveArtifact(artifact);
assert.deepEqual(initialSave.impactIndex, { updated: true, mode: "full" });
assert.equal(initialSave.storageMode, "full");
assert.equal(
  JSON.parse(await fs.readFile(
    path.join(root, artifact.id, "current.json"),
    "utf8"
  )).revisionId,
  initialSave.revisionId
);
const initial = await store.readArtifact(artifact.id);
assert.equal(initial.outputs[0].content, "alpha");
assert.equal(initial.revision.revisionId, initialSave.revisionId);

const rawManifest = JSON.parse(await fs.readFile(
  path.join(root, artifact.id, "artifact.json"),
  "utf8"
));
assert.equal("content" in rawManifest.outputs[0], false);
assert.equal(typeof rawManifest.outputs[0].contentHash, "string");
assert.equal("declaredSymbols" in rawManifest.outputs[0], false);
assert.equal(typeof rawManifest.outputs[0].contentBytes, "number");
assert.equal(Array.isArray(rawManifest.outputs[0].contentTermHashes), true);
assert.equal(rawManifest.outputs[0].contentTermIndexComplete, true);
assert.equal(
  "content" in (await store.readArtifactManifest(artifact.id)).outputs[0],
  false
);
const selectedOutputs = await store.readArtifactOutputs(
  artifact.id,
  ["b.txt"],
  { manifest: rawManifest }
);
assert.equal(selectedOutputs.length, 1);
assert.equal(selectedOutputs[0].path, "b.txt");
assert.equal(selectedOutputs[0].content, "beta");
await assert.rejects(
  () => store.readArtifactOutputs(artifact.id, ["missing.txt"]),
  /Artifact output not found/
);
const indexedPath = await store.findArtifactImpactCandidates(
  artifact.id,
  ["file:b.txt"],
  { revisionId: initial.revision.revisionId }
);
assert.equal(indexedPath.available, true);
assert.deepEqual(indexedPath.paths, ["b.txt"]);
const repairContext = await store.readArtifactRepairContext(artifact.id);
assert.equal(repairContext.mode, "head");
assert.equal(repairContext.artifact.outputCount, 2);
assert.equal("outputs" in repairContext.artifact, false);

await fs.rename(
  path.join(root, artifact.id, "blobs"),
  path.join(root, artifact.id, "blobs-hidden")
);
const summariesWithoutBlobReads = await store.listArtifactSummaries();
assert.equal(summariesWithoutBlobReads.artifacts[0].artifactId, artifact.id);
assert.deepEqual(summariesWithoutBlobReads.artifacts[0].outputPaths, ["a.txt", "b.txt"]);
await fs.rename(
  path.join(root, artifact.id, "blobs-hidden"),
  path.join(root, artifact.id, "blobs")
);

const plan = createArtifactChangePlan({
  artifact: initial,
  allowedPaths: ["a.txt"],
  proposal: {
    changes: [{
      path: "a.txt",
      replacements: [{ before: "alpha", after: "alpha-2" }],
    }],
  },
  revisionIdFactory: () => "rev-incremental",
});
const changed = applyArtifactChangePlan({ artifact: initial, changePlan: plan });
await store.saveArtifactRevision(changed);
await assert.rejects(
  () => store.saveArtifactRevision({
    ...changed,
    revision: {
      ...changed.revision,
      revisionId: "rev-stale",
      baseRevisionId: initialSave.revisionId,
    },
  }),
  /Artifact revision is stale/
);

const immutableRevisionFile = path.join(
  root,
  artifact.id,
  "revisions",
  `${changed.revision.revisionId}.json`
);
const immutableRevisionBefore = await fs.readFile(immutableRevisionFile, "utf8");
await store.saveArtifact({
  ...changed,
  notes: ["current metadata changed without creating a content revision"],
});
assert.equal(await fs.readFile(immutableRevisionFile, "utf8"), immutableRevisionBefore);
await assert.rejects(
  () => store.saveArtifact({
    ...changed,
    outputs: changed.outputs.map((output) => output.path === "a.txt"
      ? { ...output, content: "mutated-without-new-revision" }
      : output),
  }),
  /revision content is immutable/
);

assert.equal((await store.readArtifact(artifact.id)).outputs[0].content, "alpha-2");
assert.equal(
  (await store.readArtifactRevision(artifact.id, initialSave.revisionId)).outputs[0].content,
  "alpha"
);

const restored = await store.restoreArtifactRevision(artifact.id, initialSave.revisionId);
assert.equal(restored.outputs[0].content, "alpha");
assert.equal(restored.revision.mode, "rollback");

const degradedStore = new ArtifactStore({
  productionsDir: root,
  impactIndexStore: {
    async synchronize() { throw new Error("index write unavailable"); },
    async findCandidatePaths() { throw new Error("index read unavailable"); },
  },
});
const degradedSave = await degradedStore.saveArtifact({
  id: "artifact-without-index",
  type: "generic",
  title: "Index is derived",
  goal: "Persist authoritative artifact",
  outputs: [
    { kind: "file", path: "result.txt", language: "text", content: "result" },
  ],
});
assert.equal(degradedSave.impactIndex.updated, false);
assert.equal(
  (await degradedStore.readArtifact("artifact-without-index")).outputs[0].content,
  "result"
);
assert.equal(
  (await degradedStore.findArtifactImpactCandidates(
    "artifact-without-index",
    ["file:result.txt"],
    { revisionId: degradedSave.revisionId }
  )).available,
  false
);
assert.equal(
  (await degradedStore.readArtifactRepairContext("artifact-without-index")).mode,
  "manifest-fallback"
);

const compactingStore = new ArtifactStore({
  productionsDir: root,
  revisionCompactionPolicy: ({ deltaDepth }) => ({
    shouldCompact: deltaDepth >= 2,
    reason: deltaDepth >= 2 ? "test-depth-limit" : "below-threshold",
  }),
});
await compactingStore.saveArtifact({
  id: "artifact-auto-compaction",
  type: "generic",
  title: "Auto compaction",
  goal: "Keep current content",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "a-0" },
    { kind: "file", path: "b.txt", language: "text", content: "b-0" },
  ],
  notes: [],
});
const firstCompactionDelta = await createDeltaRequest({
  store: compactingStore,
  artifactId: "artifact-auto-compaction",
  outputPath: "a.txt",
  before: "a-0",
  after: "a-1",
  revisionId: "rev-compact-1",
});
const firstCompactionSave = await compactingStore.saveArtifactDelta(
  firstCompactionDelta
);
assert.equal(firstCompactionSave.compaction.performed, false);
assert.equal(firstCompactionSave.compaction.deltaDepth, 1);
const secondCompactionDelta = await createDeltaRequest({
  store: compactingStore,
  artifactId: "artifact-auto-compaction",
  outputPath: "b.txt",
  before: "b-0",
  after: "b-1",
  revisionId: "rev-compact-2",
});
const secondCompactionSave = await compactingStore.saveArtifactDelta(
  secondCompactionDelta
);
assert.equal(secondCompactionSave.compaction.performed, true);
assert.equal(secondCompactionSave.compaction.reason, "test-depth-limit");
const compactedPointer = JSON.parse(await fs.readFile(
  path.join(root, "artifact-auto-compaction", "current.json"),
  "utf8"
));
assert.equal(compactedPointer.revisionId, "rev-compact-2");
assert.equal(compactedPointer.deltaDepth, 0);
assert.equal(compactedPointer.deltaMetadataBytes, 0);
const compactedManifest = JSON.parse(await fs.readFile(
  path.join(root, "artifact-auto-compaction", "artifact.json"),
  "utf8"
));
assert.equal(compactedManifest.revision.revisionId, "rev-compact-2");
assert.equal(compactedManifest.outputs.length, 2);
assert.equal(
  (await compactingStore.readArtifact("artifact-auto-compaction"))
    .outputs.find((output) => output.path === "a.txt").content,
  "a-1"
);
assert.equal(
  (await compactingStore.readArtifact("artifact-auto-compaction"))
    .outputs.find((output) => output.path === "b.txt").content,
  "b-1"
);
assert.equal(
  JSON.parse(await fs.readFile(
    path.join(
      root,
      "artifact-auto-compaction",
      "revisions",
      "rev-compact-2.json"
    ),
    "utf8"
  )).storageMode,
  "delta"
);

await compactingStore.saveArtifact({
  id: "artifact-concurrent-writers",
  type: "generic",
  title: "Concurrent writers",
  goal: "Reject stale writes",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "a-0" },
    { kind: "file", path: "b.txt", language: "text", content: "b-0" },
  ],
  notes: [],
});
const concurrentA = await createDeltaRequest({
  store: compactingStore,
  artifactId: "artifact-concurrent-writers",
  outputPath: "a.txt",
  before: "a-0",
  after: "a-1",
  revisionId: "rev-concurrent-a",
});
const concurrentB = await createDeltaRequest({
  store: compactingStore,
  artifactId: "artifact-concurrent-writers",
  outputPath: "b.txt",
  before: "b-0",
  after: "b-1",
  revisionId: "rev-concurrent-b",
});
const firstWriterStore = new ArtifactStore({
  productionsDir: root,
  mutationCoordinator: new ArtifactMutationCoordinator(),
});
const secondWriterStore = new ArtifactStore({
  productionsDir: root,
  mutationCoordinator: new ArtifactMutationCoordinator(),
});
const concurrentResults = await Promise.allSettled([
  firstWriterStore.saveArtifactDelta(concurrentA),
  secondWriterStore.saveArtifactDelta(concurrentB),
]);
assert.equal(
  concurrentResults.filter((result) => result.status === "fulfilled").length,
  1
);
assert.equal(
  concurrentResults.filter((result) => result.status === "rejected").length,
  1
);
assert.match(
  concurrentResults.find((result) => result.status === "rejected").reason.message,
  /Artifact revision is stale/
);
const concurrentCurrent = await compactingStore.readArtifact(
  "artifact-concurrent-writers"
);
if (concurrentResults[0].status === "fulfilled") {
  assert.equal(concurrentCurrent.revision.revisionId, "rev-concurrent-a");
  assert.equal(
    concurrentCurrent.outputs.find((output) => output.path === "a.txt").content,
    "a-1"
  );
  assert.equal(
    concurrentCurrent.outputs.find((output) => output.path === "b.txt").content,
    "b-0"
  );
} else {
  assert.equal(concurrentCurrent.revision.revisionId, "rev-concurrent-b");
  assert.equal(
    concurrentCurrent.outputs.find((output) => output.path === "a.txt").content,
    "a-0"
  );
  assert.equal(
    concurrentCurrent.outputs.find((output) => output.path === "b.txt").content,
    "b-1"
  );
}

const failedCompactionStore = new ArtifactStore({
  productionsDir: root,
  revisionCompactionPolicy: () => ({
    shouldCompact: true,
    reason: "test-forced-compaction",
  }),
  artifactSnapshotWriter: async () => {
    throw new Error("snapshot writer unavailable");
  },
});
await failedCompactionStore.saveArtifact({
  id: "artifact-compaction-failure",
  type: "generic",
  title: "Compaction failure",
  goal: "Preserve authoritative delta",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "a-0" },
  ],
  notes: [],
});
const failedCompactionDelta = await createDeltaRequest({
  store: failedCompactionStore,
  artifactId: "artifact-compaction-failure",
  outputPath: "a.txt",
  before: "a-0",
  after: "a-1",
  revisionId: "rev-compaction-failure",
});
const failedCompactionSave = await failedCompactionStore.saveArtifactDelta(
  failedCompactionDelta
);
assert.equal(failedCompactionSave.compaction.performed, false);
assert.equal(failedCompactionSave.compaction.recommended, true);
assert.match(
  failedCompactionSave.compaction.error,
  /snapshot writer unavailable/
);
assert.equal(
  (await failedCompactionStore.readArtifact("artifact-compaction-failure"))
    .outputs[0].content,
  "a-1"
);
assert.equal(
  JSON.parse(await fs.readFile(
    path.join(root, "artifact-compaction-failure", "current.json"),
    "utf8"
  )).revisionId,
  "rev-compaction-failure"
);

const deltaArtifact = {
  id: "artifact-structural-sharing",
  type: "generic",
  title: "Structural sharing",
  goal: "包含 run 方法",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "run old-a" },
    { kind: "file", path: "b.txt", language: "text", content: "stable-b" },
  ],
  notes: [],
};
const deltaBaseSave = await store.saveArtifact(deltaArtifact);
const deltaBase = await store.readArtifact(deltaArtifact.id);
const deltaBaseHead = (await store.readArtifactRepairContext(deltaArtifact.id)).artifact;
const deltaPlan = createArtifactChangePlan({
  artifact: deltaBase,
  allowedPaths: ["a.txt"],
  proposal: {
    changes: [{
      path: "a.txt",
      replacements: [{ before: "old-a", after: "new-a" }],
    }],
  },
  revisionIdFactory: () => "rev-delta",
});
const deltaAppliedFull = applyArtifactChangePlan({
  artifact: deltaBase,
  changePlan: deltaPlan,
});
const previousDeltaOutputs = deltaBase.outputs.filter(
  (output) => output.path === "a.txt"
);
const deltaPartial = {
  ...deltaAppliedFull,
  outputs: deltaAppliedFull.outputs.filter((output) => output.path === "a.txt"),
};
const nextDeltaHead = evolveArtifactRepairHead({
  baseHead: deltaBaseHead,
  artifact: deltaPartial,
  previousOutputs: previousDeltaOutputs,
  nextOutputs: deltaPartial.outputs,
});
const flatManifestFile = path.join(root, deltaArtifact.id, "artifact.json");
const flatManifestBefore = await fs.readFile(flatManifestFile, "utf8");
const deltaSave = await store.saveArtifactDelta({
  artifact: deltaPartial,
  baseHead: deltaBaseHead,
  nextHead: nextDeltaHead,
});
assert.equal(deltaSave.storageMode, "delta");
assert.equal(deltaSave.impactIndex.mode, "incremental");
assert.equal(await fs.readFile(flatManifestFile, "utf8"), flatManifestBefore);
const deltaRecord = JSON.parse(await fs.readFile(
  path.join(root, deltaArtifact.id, "revisions", "rev-delta.json"),
  "utf8"
));
assert.equal(deltaRecord.storageMode, "delta");
assert.deepEqual(deltaRecord.outputs.map((output) => output.path), ["a.txt"]);
assert.equal(
  JSON.parse(await fs.readFile(
    path.join(root, deltaArtifact.id, "current.json"),
    "utf8"
  )).revisionId,
  "rev-delta"
);
const reconstructedDelta = await store.readArtifact(deltaArtifact.id);
assert.equal(reconstructedDelta.outputs[0].content, "run new-a");
assert.equal(reconstructedDelta.outputs[1].content, "stable-b");
assert.equal(
  (await store.readArtifactRevision(deltaArtifact.id, deltaBaseSave.revisionId))
    .outputs[0].content,
  "run old-a"
);
const secondDeltaHead = (await store.readArtifactRepairContext(deltaArtifact.id)).artifact;
const secondDeltaPlan = createArtifactChangePlan({
  artifact: reconstructedDelta,
  allowedPaths: ["b.txt"],
  proposal: {
    changes: [{
      path: "b.txt",
      replacements: [{ before: "stable-b", after: "changed-b" }],
    }],
  },
  revisionIdFactory: () => "rev-delta-2",
});
const secondDeltaFull = applyArtifactChangePlan({
  artifact: reconstructedDelta,
  changePlan: secondDeltaPlan,
});
const secondPreviousOutputs = reconstructedDelta.outputs.filter(
  (output) => output.path === "b.txt"
);
const secondDeltaPartial = {
  ...secondDeltaFull,
  outputs: secondDeltaFull.outputs.filter((output) => output.path === "b.txt"),
};
const secondNextHead = evolveArtifactRepairHead({
  baseHead: secondDeltaHead,
  artifact: secondDeltaPartial,
  previousOutputs: secondPreviousOutputs,
  nextOutputs: secondDeltaPartial.outputs,
});
await store.saveArtifactDelta({
  artifact: secondDeltaPartial,
  baseHead: secondDeltaHead,
  nextHead: secondNextHead,
});
const reconstructedSecondDelta = await store.readArtifact(deltaArtifact.id);
assert.equal(reconstructedSecondDelta.outputs[0].content, "run new-a");
assert.equal(reconstructedSecondDelta.outputs[1].content, "changed-b");
assert.equal(
  (await store.readArtifactRevision(deltaArtifact.id, "rev-delta"))
    .outputs[1].content,
  "stable-b"
);
assert.equal(await fs.readFile(flatManifestFile, "utf8"), flatManifestBefore);
const secondDeltaRevisionFile = path.join(
  root,
  deltaArtifact.id,
  "revisions",
  "rev-delta-2.json"
);
const secondDeltaRevisionBefore = await fs.readFile(
  secondDeltaRevisionFile,
  "utf8"
);
const compactedMetadataSave = await store.saveArtifact({
  ...reconstructedSecondDelta,
  notes: [...reconstructedSecondDelta.notes, "metadata-only update"],
});
assert.equal(compactedMetadataSave.storageMode, "full");
assert.equal(
  await fs.readFile(secondDeltaRevisionFile, "utf8"),
  secondDeltaRevisionBefore
);
assert.equal(
  JSON.parse(await fs.readFile(flatManifestFile, "utf8")).revision.revisionId,
  "rev-delta-2"
);
assert.equal(
  (await store.readArtifact(deltaArtifact.id)).notes.includes("metadata-only update"),
  true
);
await assert.rejects(
  () => store.saveArtifactDelta({
    artifact: {
      ...deltaPartial,
      revision: {
        ...deltaPartial.revision,
        revisionId: "rev-delta-stale",
      },
    },
    baseHead: deltaBaseHead,
    nextHead: {
      ...nextDeltaHead,
      revision: {
        ...nextDeltaHead.revision,
        revisionId: "rev-delta-stale",
      },
    },
  }),
  /Artifact revision is stale/
);
const deltaRestored = await store.restoreArtifactRevision(
  deltaArtifact.id,
  deltaBaseSave.revisionId
);
assert.equal(deltaRestored.outputs[0].content, "run old-a");
assert.equal((await store.readArtifact(deltaArtifact.id)).outputs[1].content, "stable-b");
assert.equal(
  JSON.parse(await fs.readFile(flatManifestFile, "utf8")).revision.mode,
  "rollback"
);

await fs.rm(root, { recursive: true, force: true });
console.log("Artifact store revision tests passed");

async function createDeltaRequest({
  store,
  artifactId,
  outputPath,
  before,
  after,
  revisionId,
}) {
  const base = await store.readArtifact(artifactId);
  const baseHead = (await store.readArtifactRepairContext(artifactId)).artifact;
  const changePlan = createArtifactChangePlan({
    artifact: base,
    allowedPaths: [outputPath],
    proposal: {
      changes: [{
        path: outputPath,
        replacements: [{ before, after }],
      }],
    },
    revisionIdFactory: () => revisionId,
  });
  const applied = applyArtifactChangePlan({ artifact: base, changePlan });
  const previousOutputs = base.outputs.filter(
    (output) => output.path === outputPath
  );
  const partial = {
    ...applied,
    outputs: applied.outputs.filter((output) => output.path === outputPath),
  };
  const nextHead = evolveArtifactRepairHead({
    baseHead,
    artifact: partial,
    previousOutputs,
    nextOutputs: partial.outputs,
  });
  return { artifact: partial, baseHead, nextHead };
}
