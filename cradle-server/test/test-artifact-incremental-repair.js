import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArtifactProductionService } from "../src/production/artifact-production-service.js";

class FakeCell {
  constructor(responseFactory) {
    this.id = "cell-incremental";
    this.provider = "test";
    this.model = "test-model";
    this.responseFactory = responseFactory;
    this.prompts = [];
    this.history = [];
    this.thoughts = [];
    this.metricIncrements = [];
    this.metricObservations = [];
    this.events = [];
    this.runtimeMetrics = {
      increment: (name, value, labels) => {
        this.metricIncrements.push({ name, value, labels });
      },
      observe: (name, value, labels) => {
        this.metricObservations.push({ name, value, labels });
      },
    };
  }

  async readEnvironment() { return "Node.js"; }
  async askWithTimeout(prompt) {
    this.events.push("llm");
    this.prompts.push(prompt);
    return { text: JSON.stringify(this.responseFactory(prompt)) };
  }
  async appendHistory(value) { this.history.push(value); }
  async appendThought(value) { this.thoughts.push(value); }
  formatTimestamp() { return "2026-01-01"; }
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-incremental-repair-"));
const cell = new FakeCell(() => ({
  summary: "修正未定義變數",
  changes: [{
    path: "src/service.js",
    replacements: [{ before: "return missing;", after: "return 'ok';" }],
  }],
}));
const service = new ArtifactProductionService({
  cell,
  assistant: { async ask() {} },
  productionsDir: root,
});
await service.store.saveArtifact({
  id: "artifact-incremental",
  type: "code",
  title: "局部修復",
  goal: "建立可執行服務，包含 run 方法",
  context: { cellId: cell.id, provider: cell.provider, model: cell.model },
  outputs: [
    {
      kind: "file",
      path: "src/service.js",
      language: "javascript",
      content: "export function run() {\n  return missing;\n}\n",
    },
    {
      kind: "file",
      path: "README.md",
      language: "markdown",
      content: "# UNRELATED-CONTENT-MUST-NOT-ENTER-PROMPT",
    },
  ],
  notes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
});
const initialManifest = await service.store.readArtifactManifest("artifact-incremental");
const unrelatedOutput = initialManifest.outputs.find(
  (output) => output.path === "README.md"
);
const unrelatedBlob = path.join(
  root,
  "artifact-incremental",
  "blobs",
  `${unrelatedOutput.contentHash}.blob`
);
const hiddenUnrelatedBlob = `${unrelatedBlob}.hidden`;
await fs.rename(unrelatedBlob, hiddenUnrelatedBlob);
const readArtifactManifest = service.store.readArtifactManifest.bind(service.store);
service.store.readArtifactManifest = async (...args) => {
  cell.events.push("manifest");
  return await readArtifactManifest(...args);
};

const result = await service.repairArtifactFromExecution({
  artifactId: "artifact-incremental",
  task: { id: "task-1", title: "修正 service.js", content: "missing 未定義" },
  executionResult: {
    status: "runtime_failed",
    stderr: "src/service.js:2 ReferenceError: missing is not defined",
  },
});
assert.equal(result.repairMode, "incremental");
assert.equal(result.artifactHydration, "head");
assert.equal("outputs" in result.artifact, false);
assert.equal(result.artifact.outputCount, 2);
assert.match(result.changedOutputs[0].content, /return 'ok'/);
assert.equal(cell.prompts[0].includes("UNRELATED-CONTENT-MUST-NOT-ENTER-PROMPT"), false);
assert.deepEqual(result.artifact.revision.changedPaths, ["src/service.js"]);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_incremental_selective_hydration_bytes"
  ),
  true
);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_repair_content_bytes_avoided" && metric.value > 0
  ),
  true
);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_incremental_full_validation_fallback"
  ),
  false
);
assert.equal(result.impact.lookupMode, "indexed");
assert.equal(result.saved.impactIndex.mode, "incremental");
assert.equal(result.saved.storageMode, "delta");
assert.equal(result.saved.compaction.performed, false);
assert.equal(result.saved.compaction.reason, "below-threshold");
assert.equal(cell.events.includes("llm"), true);
assert.equal(cell.events.includes("manifest"), false);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_flat_manifest_reads_avoided"
  ),
  true
);
assert.equal(
  cell.metricObservations.some(
    (metric) => metric.name === "artifact_revision_delta_depth" &&
      metric.value === 1
  ),
  true
);
assert.equal(
  cell.metricObservations.some(
    (metric) => metric.name === "artifact_mutation_lease_wait_ms" &&
      metric.value >= 0
  ),
  true
);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_revision_compaction" &&
      metric.labels.result === "deferred"
  ),
  true
);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_impact_lookup" &&
      metric.labels.mode === "indexed"
  ),
  true
);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_repair_context" &&
      metric.labels.mode === "head"
  ),
  true
);
assert.equal(
  cell.metricIncrements.some(
    (metric) => metric.name === "artifact_impact_index_sync" &&
      metric.labels.mode === "incremental"
  ),
  true
);
await fs.rename(hiddenUnrelatedBlob, unrelatedBlob);
const fullyHydrated = await service.store.readArtifact("artifact-incremental");
assert.match(fullyHydrated.outputs[0].content, /return 'ok'/);
assert.equal(
  fullyHydrated.outputs[1].content,
  "# UNRELATED-CONTENT-MUST-NOT-ENTER-PROMPT"
);

const singleCell = new FakeCell(() => ({
  summary: "修正單一輸出",
  changes: [{
    path: "only.txt",
    replacements: [{ before: "old-value", after: "new-value" }],
  }],
}));
const singleService = new ArtifactProductionService({
  cell: singleCell,
  assistant: { async ask() {} },
  productionsDir: root,
});
await singleService.store.saveArtifact({
  id: "artifact-single-output",
  type: "generic",
  title: "單一輸出",
  goal: "修正單一輸出",
  outputs: [
    { kind: "file", path: "only.txt", language: "text", content: "old-value" },
  ],
  notes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
});
const singleResult = await singleService.repairArtifactFromExecution({
  artifactId: "artifact-single-output",
  task: { id: "task-single", title: "修正未知行為" },
  executionResult: { status: "error", error: "unknown" },
});
assert.equal(singleResult.repairMode, "incremental");
assert.equal(singleResult.impact.lookupMode, "indexed");
assert.equal(singleResult.artifactHydration, "head");
assert.match(singleResult.changedOutputs[0].content, /new-value/);

const fallbackCell = new FakeCell(() => ({
  type: "generic",
  title: "完整修復",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "new-a" },
    { kind: "file", path: "b.txt", language: "text", content: "new-b" },
  ],
  notes: [],
}));
const fallbackService = new ArtifactProductionService({
  cell: fallbackCell,
  assistant: { async ask() {} },
  productionsDir: root,
});
await fallbackService.store.saveArtifact({
  id: "artifact-fallback",
  type: "generic",
  title: "完整修復",
  goal: "修正多檔產物",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "old-a" },
    { kind: "file", path: "b.txt", language: "text", content: "old-b" },
  ],
  notes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
});
const fallback = await fallbackService.repairArtifactFromExecution({
  artifactId: "artifact-fallback",
  task: { id: "task-2", title: "修正未知問題" },
  executionResult: { status: "error", error: "unknown" },
});
assert.equal(fallback.repairMode, "full");
assert.equal(fallback.incrementalFallback.reason, "target-not-located");
assert.equal(fallbackCell.prompts.length, 1);

await fs.rm(root, { recursive: true, force: true });
console.log("Artifact incremental repair tests passed");
