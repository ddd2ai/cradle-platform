import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { RuntimeEventAggregator } from "../src/application/runtime-event-aggregator.js";
import { RuntimeEventBus } from "../src/application/runtime-event-bus.js";
import { SseRuntimeEventTransport } from "../src/application/runtime/sse-runtime-event-transport.js";
import { WebSocketRuntimeEventTransport } from "../src/application/runtime/websocket-runtime-event-transport.js";

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.chunks = [];
  }

  write(chunk) {
    this.chunks.push(chunk);
  }

  end() {}
}

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = WebSocket.OPEN;
    this.messages = [];
  }

  send(message) {
    this.messages.push(message);
  }

  ping() {}

  close() {}
}

const eventBus = new RuntimeEventBus();
const sse = new SseRuntimeEventTransport({
  eventHistory: () => eventBus.history,
  heartbeatIntervalMs: 0,
});
const websocket = new WebSocketRuntimeEventTransport({ heartbeatIntervalMs: 0 });
const aggregator = new RuntimeEventAggregator({
  eventBus,
  transports: [sse, websocket],
});
const response = new FakeResponse();
const socket = new FakeSocket();
sse.addClient(response);
websocket.addClient(socket);
aggregator.start();

const eventCount = 1_000;
for (let index = 0; index < eventCount; index += 1) {
  aggregator.publish("operation.updated", {
    operation: { operationId: "op-load", progress: index },
  });
}

const sseEvents = response.chunks
  .filter((chunk) => chunk.startsWith("id:"))
  .map((chunk) => JSON.parse(chunk.split("\ndata: ")[1].trim()));
const websocketEvents = socket.messages.map((message) => JSON.parse(message));

assert.equal(sseEvents.length, eventCount);
assert.equal(websocketEvents.length, eventCount);
assert.deepEqual(sseEvents, websocketEvents);
assert.deepEqual(
  websocketEvents.map((event) => event.id),
  Array.from({ length: eventCount }, (_, index) => String(index + 1)),
);

aggregator.stop();
console.log("Runtime event transport parity tests passed");
