import assert from "assert";
import { CellActivationScheduler } from "../src/cell/cell-activation-scheduler.js";

const scheduler = new CellActivationScheduler({ concurrency: 2 });
let running = 0;
let maxRunning = 0;
const releases = [];

for (const cellId of ["a", "b", "c", "d"]) {
  scheduler.enqueue(cellId, async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => releases.push(resolve));
    running -= 1;
  });
}

await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(running, 2);
assert.equal(scheduler.pendingCount, 2);
releases.splice(0).forEach((release) => release());
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(running, 2);
releases.splice(0).forEach((release) => release());
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(maxRunning, 2);
assert.equal(scheduler.pendingCount, 0);

console.log("Cell activation scheduler tests passed");
