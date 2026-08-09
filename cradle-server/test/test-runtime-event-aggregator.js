import assert from "node:assert/strict";
import { RuntimeEventAggregator } from "../src/application/runtime-event-aggregator.js";
import { RuntimeEventBus } from "../src/application/runtime-event-bus.js";

const published = [];
let starts = 0;
let stops = 0;
const transport = {
  start() {
    starts += 1;
  },
  publish(event) {
    published.push(event);
  },
  stop() {
    stops += 1;
  },
};

const aggregator = new RuntimeEventAggregator({
  eventBus: new RuntimeEventBus({
    now: () => new Date("2026-08-09T00:00:00.000Z"),
  }),
  transports: [transport],
});

aggregator.start();
aggregator.start();
const event = aggregator.publish("operation.progress", {
  operationId: "op-1",
  progress: 60,
});

assert.equal(starts, 1);
assert.deepEqual(event, {
  id: "1",
  type: "operation.progress",
  timestamp: "2026-08-09T00:00:00.000Z",
  payload: { operationId: "op-1", progress: 60 },
});
assert.deepEqual(published, [event]);

aggregator.stop();
aggregator.publish("operation.progress", { operationId: "op-1", progress: 80 });
assert.equal(published.length, 1);
assert.equal(stops, 1);

console.log("Runtime event aggregator tests passed");
