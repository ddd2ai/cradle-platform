import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { SseRuntimeEventTransport } from "../src/application/runtime/sse-runtime-event-transport.js";

class FakeResponse extends EventEmitter {
  constructor() {
    super();
    this.chunks = [];
    this.ended = false;
  }

  write(chunk) {
    this.chunks.push(chunk);
  }

  end() {
    this.ended = true;
  }
}

const history = [
  { id: "1", type: "cell.updated", timestamp: "t1", payload: { cellId: "a" } },
  { id: "2", type: "cell.updated", timestamp: "t2", payload: { cellId: "b" } },
];
const transport = new SseRuntimeEventTransport({
  eventHistory: () => history,
  heartbeatIntervalMs: 0,
});
const first = new FakeResponse();
const second = new FakeResponse();

transport.addClient(first, { afterEventId: "1" });
transport.addClient(second);
assert.equal(first.chunks[0], ": connected\n\n");
assert.ok(first.chunks[1].includes('"id":"2"'));

const event = {
  id: "3",
  type: "operation.updated",
  timestamp: "t3",
  payload: { operation: { operationId: "op-1" } },
};
transport.publish(event);
assert.ok(first.chunks.at(-1).includes(JSON.stringify(event)));
assert.ok(second.chunks.at(-1).includes(JSON.stringify(event)));

first.emit("close");
const firstChunkCount = first.chunks.length;
transport.publish({ ...event, id: "4" });
assert.equal(first.chunks.length, firstChunkCount);

transport.stop();
assert.equal(second.ended, true);
assert.equal(transport.clients.size, 0);

console.log("SSE runtime event transport tests passed");
