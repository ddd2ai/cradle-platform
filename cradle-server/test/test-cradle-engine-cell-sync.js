import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CradleEngine } from "../src/cradle-engine.js";

class SyncTestEngine extends CradleEngine {
  async registerCell(id) {
    const cell = { id };
    this.cells.set(id, cell);
    this.inboxes.set(id, []);
    return cell;
  }
}

const projectRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-engine-sync-")
);
const cellsDir = path.join(projectRoot, "cells");
await fs.mkdir(path.join(cellsDir, "existing-cell"), { recursive: true });

const engine = new SyncTestEngine({ projectRoot });
await engine.syncCellsFromDisk();
assert.deepEqual(engine.listCellIds(), ["existing-cell"]);

await fs.mkdir(path.join(cellsDir, "new-cell"), { recursive: true });
await engine.syncCellsFromDisk();
assert.deepEqual(
  engine.listCellIds().sort(),
  ["existing-cell", "new-cell"]
);

const initializingDir = path.join(cellsDir, "initializing-cell");
await fs.mkdir(initializingDir, { recursive: true });
await fs.writeFile(path.join(initializingDir, ".cell-initializing"), "");
await engine.syncCellsFromDisk();
assert.equal(engine.hasCell("initializing-cell"), false);

await fs.rm(path.join(initializingDir, ".cell-initializing"));
await engine.syncCellsFromDisk();
assert.equal(engine.hasCell("initializing-cell"), true);

engine.stagedCellIds.add("new-cell");
assert.equal(engine.getCell("new-cell"), null);
assert.equal(engine.listCellIds().includes("new-cell"), false);

const actorWakeups = [];
engine.cells.set("actor-a", {
  id: "actor-a",
  runtimeLifecycleService: {
    requestActivation: (reason) => actorWakeups.push(["actor-a", reason]),
    requestSummaryFlush: (reason) => actorWakeups.push(["actor-a-summary", reason]),
  },
});
engine.cells.set("actor-b", {
  id: "actor-b",
  runtimeLifecycleService: {
    requestActivation: (reason) => actorWakeups.push(["actor-b", reason]),
    requestSummaryFlush: (reason) => actorWakeups.push(["actor-b-summary", reason]),
  },
});
engine.notifyCellActors(["actor-b", "actor-b", "missing"], "targeted-stimulus");
assert.deepEqual(actorWakeups, [["actor-b", "targeted-stimulus"]]);
engine.notifyCellActors(
  ["actor-a"],
  "passive-stimulus",
  { admission: { activate: false } }
);
assert.deepEqual(actorWakeups.at(-1), ["actor-a-summary", "passive-stimulus"]);

await fs.rm(projectRoot, { recursive: true, force: true });

console.log("Cradle engine cell sync tests passed");
