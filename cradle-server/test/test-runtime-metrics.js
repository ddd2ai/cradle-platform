import assert from "assert";
import { RuntimeMetrics } from "../src/application/runtime-metrics.js";

const metrics = new RuntimeMetrics({
  sampleLimit: 3,
  now: () => new Date("2026-08-31T00:00:00.000Z"),
});
metrics.increment("activation", 2, { cellId: "cell-a" });
metrics.gauge("queue", 3);
for (const value of [1, 2, 3, 4]) metrics.observe("latency", value);

const snapshot = metrics.snapshot();
assert.equal(snapshot.counters["activation{cellId=cell-a}"], 2);
assert.equal(snapshot.gauges.queue, 3);
assert.equal(snapshot.distributions.latency.count, 3);
assert.equal(snapshot.distributions.latency.min, 2);
assert.equal(snapshot.distributions.latency.max, 4);

console.log("Runtime metrics tests passed");
