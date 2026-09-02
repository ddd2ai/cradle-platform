import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CellCultivationStateStore } from "../src/cell/cell-cultivation-state-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-cultivation-state-"));
try {
  const store = new CellCultivationStateStore({
    file: path.join(root, "state.json"),
    cellId: "cell-a",
    now: () => new Date("2026-09-02T12:00:00.000Z"),
  });
  assert.equal((await store.read()).state, "dormant");
  await store.update({ state: "growing", progress: 54.6, phase: "cultivating" });
  assert.equal((await store.read()).progress, 55);
  const interrupted = await store.reconcileInterrupted();
  assert.equal(interrupted.state, "needs_attention");
  assert.equal(interrupted.attention.code, "CULTIVATION_INTERRUPTED");
  await assert.rejects(() => store.update({ state: "pretending" }), /Invalid Cell life state/);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("Cell cultivation state store tests passed");
