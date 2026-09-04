import assert from "node:assert/strict";
import { LlmCallScheduler } from "../src/ai/llm-call-scheduler.js";
import { RuntimeMetrics } from "../src/application/runtime-metrics.js";
import { CradleCell } from "../src/cradle-cell.js";

const scheduler = new LlmCallScheduler({ concurrency: 2 });
let running = 0;
let maxRunning = 0;
const releases = [];

const work = ["a", "b", "c", "d"].map(() => scheduler.run(async () => {
  running += 1;
  maxRunning = Math.max(maxRunning, running);
  await new Promise((resolve) => releases.push(resolve));
  running -= 1;
}));

await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(running, 2);
assert.equal(scheduler.pendingCount, 2);
releases.splice(0).forEach((release) => release());
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(running, 2);
releases.splice(0).forEach((release) => release());
await Promise.all(work);
assert.equal(maxRunning, 2);
assert.equal(scheduler.pendingCount, 0);

const occupied = new LlmCallScheduler({ concurrency: 1 });
let releaseOccupied;
const first = occupied.run(() => new Promise((resolve) => { releaseOccupied = resolve; }));
const controller = new AbortController();
const queued = occupied.run(async () => {}, { signal: controller.signal });
controller.abort(new Error("queue deadline exceeded"));
await assert.rejects(queued, /queue deadline exceeded/);
assert.equal(occupied.pendingCount, 0);
releaseOccupied();
await first;

const metrics = new RuntimeMetrics();
const timeoutScheduler = new LlmCallScheduler({ concurrency: 1, metrics });
const timeoutCell = new CradleCell({
  id: "timeout-cell",
  llmCallScheduler: timeoutScheduler,
  runtimeMetrics: metrics,
});
let providerRunning = 0;
timeoutCell.assistant = {
  async ask(_input, { signal }) {
    providerRunning += 1;
    const pendingRequest = setInterval(() => {}, 1_000);
    return await new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        clearInterval(pendingRequest);
        providerRunning -= 1;
        reject(signal.reason);
      }, { once: true });
    });
  },
};
await assert.rejects(
  timeoutCell.askWithTimeout("hang", 20),
  /Timeout after 20ms/,
);
await Promise.resolve();
assert.equal(providerRunning, 0);
assert.equal(timeoutScheduler.running, 0);
assert.equal(
  metrics.snapshot().counters[
    "llm_timeouts{cellId=timeout-cell,model=auto,provider=codex}"
  ],
  1,
);

console.log("LLM call scheduler tests passed");
