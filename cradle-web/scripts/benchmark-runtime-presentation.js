import os from "node:os";
import { performance } from "node:perf_hooks";
import { RuntimePresentationStore } from "../src/services/runtime/runtime-presentation-store.js";

const eventCount = 1_000;
const warmups = 25;
const samples = 200;

for (let index = 0; index < warmups; index += 1) runSample();
globalThis.gc?.();
const heapBefore = process.memoryUsage().heapUsed;
const results = Array.from({ length: samples }, runSample);
globalThis.gc?.();
const heapAfter = process.memoryUsage().heapUsed;

const baseline = summarize(results.map((result) => result.baselineMs));
const coalesced = summarize(results.map((result) => result.coalescedMs));
console.log(JSON.stringify({
  schemaVersion: 1,
  status: "current-state-comparison",
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  cpu: os.cpus()[0]?.model ?? "unknown",
  logicalCpuCount: os.cpus().length,
  workload: { eventCount, warmups, samples, cells: 1 },
  baseline: {
    ...baseline,
    subscriberCalls: eventCount,
    terminalProgress: 999,
  },
  coalesced: {
    ...coalesced,
    subscriberCalls: 1,
    pendingEventsAtFlush: 1,
    terminalProgress: 999,
  },
  retainedHeapDeltaBytes: heapAfter - heapBefore,
}, null, 2));

function runSample() {
  let baselineProgress = null;
  let baselineCalls = 0;
  const baselineListener = (event) => {
    baselineCalls += 1;
    baselineProgress = event.payload.cultivation.progress;
  };
  const baselineStarted = performance.now();
  for (let progress = 0; progress < eventCount; progress += 1) {
    baselineListener({
      type: "cell.cultivation.updated",
      payload: { cellId: "cell-1", cultivation: { progress } },
    });
  }
  const baselineMs = performance.now() - baselineStarted;

  let scheduled = null;
  let coalescedProgress = null;
  const store = new RuntimePresentationStore({ schedule: (callback) => { scheduled = callback; } });
  store.subscribe((events) => {
    coalescedProgress = events[0].payload.cultivation.progress;
  });
  const coalescedStarted = performance.now();
  for (let progress = 0; progress < eventCount; progress += 1) {
    store.enqueue({
      type: "cell.cultivation.updated",
      payload: { cellId: "cell-1", cultivation: { progress } },
    });
  }
  const pendingEventsAtFlush = store.pendingEventCount;
  scheduled();
  const coalescedMs = performance.now() - coalescedStarted;

  if (
    baselineProgress !== 999 ||
    baselineCalls !== eventCount ||
    coalescedProgress !== 999 ||
    pendingEventsAtFlush !== 1
  ) {
    throw new Error("Presentation benchmark correctness invariant failed");
  }
  return { baselineMs, coalescedMs };
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const totalMs = values.reduce((sum, value) => sum + value, 0);
  return {
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    throughputEventsPerSecond: Math.round((eventCount * values.length * 1_000) / totalMs),
  };
}

function percentile(sorted, ratio) {
  return Number(sorted[Math.ceil(sorted.length * ratio) - 1].toFixed(4));
}
