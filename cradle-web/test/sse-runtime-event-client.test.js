import assert from "node:assert/strict";
import { test } from "node:test";
import { SseRuntimeEventClient } from "../src/services/runtime/sse-runtime-event-client.js";

test("SSE runtime client preserves the canonical runtime event", () => {
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.listeners = new Map();
      this.closed = false;
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    close() {
      this.closed = true;
    }
  }

  const events = [];
  const client = new SseRuntimeEventClient("/api/v1/events", {
    EventSourceFactory: FakeEventSource,
  });
  client.subscribe((event) => events.push(event));
  client.connect();

  const runtimeEvent = {
    id: "1",
    type: "cell.updated",
    timestamp: "2026-08-09T00:00:00.000Z",
    payload: { cellId: "cell-001" },
  };
  client.eventSource.listeners.get("cell.updated")({
    data: JSON.stringify(runtimeEvent),
  });

  assert.deepEqual(events, [runtimeEvent]);
  client.disconnect();
  assert.equal(client.eventSource, null);
});
