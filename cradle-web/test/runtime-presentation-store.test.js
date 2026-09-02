import assert from "node:assert/strict";
import { test } from "node:test";
import { RuntimePresentationStore } from "../src/services/runtime/runtime-presentation-store.js";

test("runtime presentation store batches a frame and keeps latest transient values", () => {
  let flush;
  const batches = [];
  const store = new RuntimePresentationStore({
    schedule(callback) {
      flush = callback;
    },
  });
  store.subscribe((events) => batches.push(events));

  store.enqueue({
    type: "operation.updated",
    payload: { operation: { operationId: "op-1", progress: 10 } },
  });
  store.enqueue({ type: "cell.created", payload: { cellId: "cell-1" } });
  store.enqueue({
    type: "operation.updated",
    payload: { operation: { operationId: "op-1", progress: 90 } },
  });
  store.enqueue({
    type: "cell.cultivation.updated",
    payload: { cellId: "cell-1", cultivation: { progress: 42 } },
  });
  store.enqueue({
    type: "cell.cultivation.updated",
    payload: { cellId: "cell-1", cultivation: { progress: 90 } },
  });

  assert.equal(batches.length, 0);
  flush();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 3);
  assert.equal(batches[0][0].payload.operation.progress, 90);
  assert.equal(batches[0][2].payload.cultivation.progress, 90);
});

test("100 cultivation updates for one Cell become one presentation update", () => {
  let flush;
  let events = null;
  const store = new RuntimePresentationStore({ schedule: (callback) => { flush = callback; } });
  store.subscribe((batch) => { events = batch; });

  for (let progress = 0; progress < 100; progress += 1) {
    store.enqueue({
      type: "cell.cultivation.updated",
      payload: { cellId: "cell-1", cultivation: { progress } },
    });
  }

  assert.equal(store.pendingEventCount, 1);
  flush();
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.cultivation.progress, 99);
});
