import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { WebSocketRuntimeEventTransport } from "../src/application/runtime/websocket-runtime-event-transport.js";

class FakeSocket extends EventEmitter {
  constructor(readyState = WebSocket.OPEN) {
    super();
    this.readyState = readyState;
    this.sent = [];
    this.pings = 0;
    this.closed = false;
    this.terminated = false;
  }

  send(payload) {
    this.sent.push(payload);
  }

  ping() {
    this.pings += 1;
  }

  close() {
    this.closed = true;
  }

  terminate() {
    this.terminated = true;
  }
}

let heartbeat;
const transport = new WebSocketRuntimeEventTransport({
  setIntervalFn(callback) {
    heartbeat = callback;
    return { unref() {} };
  },
  clearIntervalFn() {},
});
const first = new FakeSocket();
const second = new FakeSocket();
const closed = new FakeSocket(WebSocket.CLOSED);
transport.addClient(first);
transport.addClient(second);
transport.addClient(closed);
transport.start();

const event = { id: "1", type: "cell.updated", timestamp: "t1", payload: {} };
transport.publish(event);
assert.deepEqual(first.sent, [JSON.stringify(event)]);
assert.deepEqual(second.sent, [JSON.stringify(event)]);
assert.deepEqual(closed.sent, []);

first.emit("close");
transport.publish({ ...event, id: "2" });
assert.equal(first.sent.length, 1);
assert.equal(second.sent.length, 2);

heartbeat();
assert.equal(second.pings, 1);
heartbeat();
assert.equal(second.terminated, true);
assert.equal(transport.clients.has(second), false);

transport.stop();
assert.equal(closed.closed, true);
assert.equal(transport.clientCount, 0);

console.log("WebSocket runtime event transport tests passed");
