import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configureRuntimeEventClient,
  subscribeToCradleEvents,
} from "../src/services/cradle-event-stream.js";
import {
  registerResourceLoader,
  resetInvalidationState,
} from "../src/services/resource-invalidation.js";

class FakeRuntimeEventClient {
  constructor() {
    this.listeners = new Set();
    this.connectionListeners = new Set();
    this.connectCalls = 0;
    this.disconnectCalls = 0;
  }

  connect() {
    this.connectCalls += 1;
  }

  disconnect() {
    this.disconnectCalls += 1;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeConnection(listener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  emit(event) {
    for (const listener of this.listeners) listener(event);
  }

  emitConnection(state) {
    for (const listener of this.connectionListeners) listener(state);
  }
}

test("Cradle events share one runtime client and fan out canonical events", async () => {
  const client = new FakeRuntimeEventClient();
  configureRuntimeEventClient(client);
  const firstEvents = [];
  const secondEvents = [];
  let reconciliations = 0;
  resetInvalidationState();
  registerResourceLoader("cells", async () => {
    reconciliations += 1;
  });
  const unsubscribeFirst = subscribeToCradleEvents((event) => firstEvents.push(event));
  const unsubscribeSecond = subscribeToCradleEvents((event) => secondEvents.push(event));

  assert.equal(client.connectCalls, 1);
  client.emit({
    id: "1",
    type: "cell.updated",
    timestamp: "2026-08-09T00:00:00.000Z",
    payload: { cellId: "cell-001" },
  });
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(firstEvents[0].type, "cell.updated");
  assert.equal(secondEvents[0].payload.cellId, "cell-001");

  client.emitConnection({ connected: true, reconnected: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reconciliations, 1);

  client.emit({
    id: "2",
    type: "operation.updated",
    timestamp: "2026-08-09T00:00:01.000Z",
    payload: { operation: { operationId: "op-1", status: "completed" } },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reconciliations, 2);

  unsubscribeFirst();
  assert.equal(client.disconnectCalls, 0);
  unsubscribeSecond();
  assert.equal(client.disconnectCalls, 1);
  resetInvalidationState();
});
