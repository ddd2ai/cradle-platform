import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArtifactProductionService } from "../src/production/artifact-production-service.js";
import {
  ARTIFACT_OWNER_VIOLATION,
  bindArtifactOwner,
  resolveArtifactOwnerCellId,
} from "../src/production/artifact-ownership-policy.js";
import { createArtifact } from "../src/production/artifact-schema.js";
import { ArtifactStore } from "../src/production/artifact-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-artifact-owner-"));
try {
  const artifact = createArtifact({
    id: "artifact-owned",
    type: "generic",
    title: "Owned artifact",
    goal: "Preserve one authoritative owner",
    cellId: "cell-owner",
    provider: "codex",
    model: "codex",
    outputs: [{
      kind: "file",
      path: "result.txt",
      language: "text",
      content: "owner",
    }],
  });
  assert.equal(artifact.ownerCellId, "cell-owner");
  assert.equal(resolveArtifactOwnerCellId(artifact), "cell-owner");

  assert.throws(
    () => resolveArtifactOwnerCellId({
      ...artifact,
      ownerCellId: "cell-other",
    }),
    (error) => error.code === ARTIFACT_OWNER_VIOLATION
  );

  const canonicalLegacy = bindArtifactOwner({
    id: "artifact-legacy",
    context: { cellId: "cell-owner" },
  }, "cell-owner");
  assert.equal(canonicalLegacy.ownerCellId, "cell-owner");

  const ownerStore = new ArtifactStore({
    productionsDir: root,
    ownerCellId: "cell-owner",
  });
  await ownerStore.saveArtifact(artifact);
  const pointer = JSON.parse(await fs.readFile(
    path.join(root, artifact.id, "current.json"),
    "utf8"
  ));
  assert.equal(pointer.ownerCellId, "cell-owner");
  assert.equal(
    (await ownerStore.listArtifactSummaries()).artifacts[0].ownerCellId,
    "cell-owner"
  );

  let coordinatorCalls = 0;
  let leaseCalls = 0;
  const foreignStore = new ArtifactStore({
    productionsDir: root,
    ownerCellId: "cell-other",
    mutationCoordinator: {
      async runExclusive(_key, operation) {
        coordinatorCalls += 1;
        return await operation();
      },
    },
    mutationLease: {
      async runExclusive(_dir, operation) {
        leaseCalls += 1;
        return await operation({ waitMs: 0, contentionCount: 0 });
      },
    },
  });
  const persisted = await ownerStore.readArtifact(artifact.id);
  await assert.rejects(
    () => foreignStore.saveArtifact(persisted),
    (error) => error.code === ARTIFACT_OWNER_VIOLATION
  );
  assert.equal(coordinatorCalls, 0);
  assert.equal(leaseCalls, 0);

  let aiCalls = 0;
  const metrics = [];
  const foreignCell = {
    id: "cell-other",
    provider: "codex",
    model: "codex",
    runtimeMetrics: {
      increment(name, value, labels) {
        metrics.push({ name, value, labels });
      },
    },
    async askWithTimeout() {
      aiCalls += 1;
      throw new Error("AI must not be called for a foreign Artifact");
    },
    async readEnvironment() { return "test"; },
    formatTimestamp() { return "20260831-000000"; },
  };
  const foreignProductionService = new ArtifactProductionService({
    cell: foreignCell,
    productionsDir: root,
  });
  await assert.rejects(
    () => foreignProductionService.repairArtifactFromExecution({
      artifactId: artifact.id,
      task: { id: "task-foreign", title: "Foreign repair" },
      executionResult: { status: "runtime_failed" },
    }),
    (error) => error.code === ARTIFACT_OWNER_VIOLATION
  );
  assert.equal(aiCalls, 0);
  assert.deepEqual(metrics, [{
    name: "artifact_mutation_owner_violation",
    value: 1,
    labels: { cellId: "cell-other", artifactId: artifact.id },
  }]);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("Artifact ownership tests passed.");
