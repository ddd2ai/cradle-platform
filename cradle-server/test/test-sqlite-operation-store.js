import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SqliteOperationStore } from "../src/persistence/sqlite-operation-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-sqlite-operation-"));
const file = path.join(root, "runtime", "cradle.sqlite");
const events = [];
const store = new SqliteOperationStore({
  file,
  eventBus: { publish: (type, payload) => events.push({ type, payload }) },
  limit: 10,
});

const operation = store.create({
  type: "stimulus-cultivation",
  context: { cellIds: ["cell-a"], artifactType: "code" },
});
assert.equal(operation.status, "accepted");
assert.equal(store.get(operation.operationId).context.artifactType, "code");

const completed = store.update(operation.operationId, {
  status: "completed",
  progress: 100,
  currentStage: "stable",
  lifeState: "stable",
  result: {
    cells: [{
      cellId: "cell-a",
      artifactEvolution: { decision: "created", artifactId: "artifact-a", revisionId: "rev-a" },
    }],
  },
  completedAt: "2026-09-04T12:00:01.000Z",
});
assert.equal(completed.result.cells[0].artifactEvolution.artifactId, "artifact-a");
assert.equal(events.some((event) => event.type === "artifacts.updated"), true);

store.close();
const reopened = new SqliteOperationStore({ file, limit: 10 });
assert.equal(reopened.get(operation.operationId).status, "completed");
assert.equal(reopened.list()[0].result.cells[0].artifactEvolution.revisionId, "rev-a");

const interrupted = reopened.create({ type: "stimulus-cultivation", context: { cellIds: ["cell-b"] } });
reopened.update(interrupted.operationId, { status: "running", currentStage: "cultivating" });
assert.equal(reopened.reconcileInterrupted(), 1);
const recovered = reopened.get(interrupted.operationId);
assert.equal(recovered.status, "failed");
assert.equal(recovered.lifeState, "needs_attention");
assert.equal(recovered.error.code, "OPERATION_INTERRUPTED");
assert.ok(recovered.failedAt);

reopened.close();
await fs.rm(root, { recursive: true, force: true });
console.log("SQLite operation store tests passed");
