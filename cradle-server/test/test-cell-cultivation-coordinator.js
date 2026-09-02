import assert from "node:assert/strict";
import { CellCultivationCoordinator } from "../src/application/cell-cultivation-coordinator.js";

const coordinator = new CellCultivationCoordinator();
const order = [];
let releaseFirst;
const gate = new Promise((resolve) => { releaseFirst = resolve; });
const first = coordinator.run("cell-a", async () => {
  order.push("first:start");
  await gate;
  order.push("first:end");
  return 1;
});
const second = coordinator.run("cell-a", async () => {
  order.push("second:start");
  return 2;
});
const independent = coordinator.run("cell-b", async () => {
  order.push("independent");
  return 3;
});

await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(order, ["first:start", "independent"]);
assert.equal(coordinator.isBusy("cell-a"), true);
releaseFirst();
assert.deepEqual(await Promise.all([first, second, independent]), [1, 2, 3]);
assert.deepEqual(order, ["first:start", "independent", "first:end", "second:start"]);
assert.equal(coordinator.isBusy("cell-a"), false);

const failed = coordinator.run("cell-a", async () => { throw new Error("expected"); });
await assert.rejects(failed, /expected/);
assert.equal(await coordinator.run("cell-a", async () => "recovered"), "recovered");

console.log("Cell cultivation coordinator tests passed");
