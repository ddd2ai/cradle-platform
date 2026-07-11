import assert from "node:assert/strict";
import { CellFusionService } from "../src/lifecycle/cell-fusion-service.js";

const parentCells = [
  { id: "cell-001" },
  { id: "cell-002" },
];
const existingChild = { id: "cell-003" };
const engine = {
  cells: new Map([[existingChild.id, existingChild]]),
  createCell: async () => {
    throw new Error("createCell should not run for an existing child");
  },
};

assert.equal(typeof engine.listCells, "undefined");

const service = new CellFusionService();

await assert.rejects(
  service.fuse({
    engine,
    parentCells,
    childId: existingChild.id,
  }),
  /child cell already exists: cell-003/,
);

console.log("✅ CellFusionService uses the injected CradleEngine cells registry");
