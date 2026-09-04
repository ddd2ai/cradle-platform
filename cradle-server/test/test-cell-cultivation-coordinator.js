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

const cancellationOrder = [];
const cancellationGate = deferred();
const firstBlocking = coordinator.run("cell-cancel", async () => {
  cancellationOrder.push("first:start");
  await cancellationGate.promise;
  cancellationOrder.push("first:end");
});
const controller = new AbortController();
let cancelledTaskCalled = false;
const cancelled = coordinator.run("cell-cancel", async () => {
  cancelledTaskCalled = true;
}, { signal: controller.signal });
controller.abort(Object.assign(new Error("cancel queued cultivation"), {
  code: "OPERATION_CANCELLED",
}));
await assert.rejects(cancelled, /cancel queued cultivation/);
const afterCancelled = coordinator.run("cell-cancel", async () => {
  cancellationOrder.push("third:start");
});
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(cancellationOrder, ["first:start"]);
assert.equal(cancelledTaskCalled, false);
cancellationGate.resolve();
await Promise.all([firstBlocking, afterCancelled]);
assert.deepEqual(cancellationOrder, ["first:start", "first:end", "third:start"]);

console.log("Cell cultivation coordinator tests passed");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
