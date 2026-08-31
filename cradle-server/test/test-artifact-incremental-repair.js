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
  }

  async readEnvironment() { return "Node.js"; }
  async askWithTimeout(prompt) {
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
  goal: "建立可執行服務",
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

const result = await service.repairArtifactFromExecution({
  artifactId: "artifact-incremental",
  task: { id: "task-1", title: "修正 service.js", content: "missing 未定義" },
  executionResult: {
    status: "runtime_failed",
    stderr: "src/service.js:2 ReferenceError: missing is not defined",
  },
});
assert.equal(result.repairMode, "incremental");
assert.match(result.artifact.outputs[0].content, /return 'ok'/);
assert.equal(
  result.artifact.outputs[1].content,
  "# UNRELATED-CONTENT-MUST-NOT-ENTER-PROMPT"
);
assert.equal(cell.prompts[0].includes("UNRELATED-CONTENT-MUST-NOT-ENTER-PROMPT"), false);
assert.deepEqual(result.artifact.revision.changedPaths, ["src/service.js"]);

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
