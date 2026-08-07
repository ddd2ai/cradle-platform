import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CellDivisionRollback } from "../src/lifecycle/cell-division-rollback.js";

const projectRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-division-rollback-")
);
const cellsDir = path.join(projectRoot, "cells");
const parentRootDir = path.join(cellsDir, "parent-cell");
const childRootDir = path.join(cellsDir, "child-cell");
const parentStateFile = path.join(parentRootDir, "cell.json");

await fs.mkdir(parentRootDir, { recursive: true });
await fs.writeFile(parentStateFile, JSON.stringify({ state: "before" }));

const parentCell = {
  id: "parent-cell",
  rootDir: parentRootDir,
  cellsDir,
};
const engine = {
  projectRoot,
  activeCellId: "parent-cell",
  cells: new Map([[parentCell.id, parentCell]]),
  inboxes: new Map(),
};
const rollback = new CellDivisionRollback({
  engine,
  parentCell,
  childId: "child-cell",
});

await rollback.begin();
await fs.writeFile(parentStateFile, JSON.stringify({ state: "partial" }));
await fs.mkdir(childRootDir, { recursive: true });
await fs.writeFile(path.join(childRootDir, "partial.json"), "{}");
engine.cells.set("child-cell", { id: "child-cell", rootDir: childRootDir });
engine.activeCellId = "child-cell";

await rollback.compensate();

assert.deepEqual(
  JSON.parse(await fs.readFile(parentStateFile, "utf8")),
  { state: "before" }
);
await assert.rejects(() => fs.access(childRootDir));
assert.equal(engine.cells.has("child-cell"), false);
assert.equal(engine.activeCellId, "parent-cell");

await fs.rm(projectRoot, { recursive: true, force: true });

console.log("Cell division rollback tests passed");
