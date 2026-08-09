import assert from "node:assert/strict";
import { test } from "node:test";
import { WebSocketRuntimeEventClient } from "../src/services/runtime/websocket-runtime-event-client.js";

test("WebSocket runtime client reconnects with backoff and marks restored connections", () => {
  class FakeWebSocket {
    static instances = [];

    constructor(url) {
      this.url = url;
      this.closed = false;
      FakeWebSocket.instances.push(this);
    }

    close() {
      this.closed = true;
    }
  }

  const timers = [];
  const states = [];
  const events = [];
  const client = new WebSocketRuntimeEventClient("ws://localhost/api/v1/runtime/events", {
    WebSocketFactory: FakeWebSocket,
    retryDelaysMs: [1_000, 2_000],
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeoutFn() {},
  });
  client.subscribe((event) => events.push(event));
  client.subscribeConnection((state) => states.push(state));

  client.connect();
  const first = FakeWebSocket.instances[0];
  first.onopen();
  first.onmessage({ data: JSON.stringify({ id: "1", type: "cell.updated", payload: {} }) });
  first.onclose();

  assert.equal(events.length, 1);
  assert.deepEqual(states[0], { connected: true, reconnected: false });
  assert.equal(timers[0].delay, 1_000);

  timers[0].callback();
  const second = FakeWebSocket.instances[1];
  second.onopen();
  assert.deepEqual(states.at(-1), { connected: true, reconnected: true });

  client.disconnect();
  assert.equal(second.closed, true);
});
