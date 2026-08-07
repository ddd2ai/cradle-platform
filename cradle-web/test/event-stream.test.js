import assert from "node:assert/strict";
import { test } from "node:test";
import { subscribeToCradleEvents } from "../src/services/cradle-event-stream.js";

test("Cradle events share one EventSource and fan out typed events", () => {
  const originalEventSource = globalThis.EventSource;

  class FakeEventSource {
    static instances = [];

    constructor(url) {
      this.url = url;
      this.listeners = new Map();
      this.closed = false;
      FakeEventSource.instances.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    emit(type, data) {
      this.listeners.get(type)?.({ data: JSON.stringify(data) });
    }

    close() {
      this.closed = true;
    }
  }

  globalThis.EventSource = FakeEventSource;
  const firstEvents = [];
  const secondEvents = [];

  try {
    const unsubscribeFirst = subscribeToCradleEvents((event) => firstEvents.push(event));
    const unsubscribeSecond = subscribeToCradleEvents((event) => secondEvents.push(event));

    assert.equal(FakeEventSource.instances.length, 1);
    const source = FakeEventSource.instances[0];
    assert.equal(source.url, "/api/v1/events");

    source.emit("operation.updated", {
      operation: { operationId: "op-1", status: "running" },
    });
    assert.equal(firstEvents[0].type, "operation.updated");
    assert.equal(secondEvents[0].data.operation.operationId, "op-1");

    unsubscribeFirst();
    assert.equal(source.closed, false);
    unsubscribeSecond();
    assert.equal(source.closed, true);
  } finally {
    globalThis.EventSource = originalEventSource;
  }
});
