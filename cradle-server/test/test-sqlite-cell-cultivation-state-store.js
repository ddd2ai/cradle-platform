import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SqliteCellCultivationStateStore } from "../src/persistence/sqlite-cell-cultivation-state-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-sqlite-cell-state-"));
const file = path.join(root, "runtime.sqlite");
const legacyFile = path.join(root, "cultivation-state.json");
await fs.writeFile(legacyFile, JSON.stringify({
  schemaVersion: 1,
  cellId: "cell-a",
  state: "growing",
  progress: 58,
  phase: "cultivating",
  operationId: "op-old",
  stimulusId: "stim-old",
  attention: null,
  evidence: [],
  updatedAt: "2026-09-04T10:00:00.000Z",
}));

const store = new SqliteCellCultivationStateStore({ file, cellId: "cell-a", legacyFile });
const migrated = await store.read();
assert.equal(migrated.state, "growing");
assert.equal(migrated.operationId, "op-old");
assert.equal(migrated.progress, 58);

const interrupted = await store.reconcileInterrupted();
assert.equal(interrupted.state, "needs_attention");
assert.equal(interrupted.phase, "interrupted");
assert.equal(interrupted.attention.code, "CULTIVATION_INTERRUPTED");

const cancelled = await store.update({ state: "cancelled", phase: "cancelled", progress: 100 });
assert.equal(cancelled.state, "cancelled");
assert.equal(cancelled.progress, 100);
store.close();

const reopened = new SqliteCellCultivationStateStore({ file, cellId: "cell-a", legacyFile });
assert.equal((await reopened.read()).state, "cancelled");
await assert.rejects(() => reopened.update({ state: "invalid" }), /Invalid Cell life state/);
reopened.close();
await fs.rm(root, { recursive: true, force: true });
console.log("SQLite Cell cultivation state store tests passed");
