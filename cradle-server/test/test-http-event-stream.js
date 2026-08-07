import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  ApplicationEventStream,
  createApplicationEventResponse,
} from "../src/application/application-event-stream.js";
import { createHttpServer } from "../src/api/http-server.js";

const eventStream = new ApplicationEventStream();
const server = createHttpServer({
  handler: async () => createApplicationEventResponse({ eventStream }),
});
const request = new EventEmitter();
request.method = "GET";
request.url = "/api/v1/events";
request.headers = {};

const chunks = [];
const response = {
  status: null,
  headers: null,
  writeHead(status, headers) {
    this.status = status;
    this.headers = headers;
  },
  flushHeaders() {},
  write(chunk) {
    chunks.push(chunk);
    return true;
  },
  end() {
    throw new Error("SSE response must remain open");
  },
};

server.emit("request", request, response);
request.emit("end");
await new Promise((resolve) => setImmediate(resolve));

assert.equal(response.status, 200);
assert.equal(response.headers["content-type"], "text/event-stream; charset=utf-8");
assert.equal(chunks[0], ": connected\n\n");

eventStream.publish("cell.updated", { cellId: "cell-001" });
assert.ok(chunks[1].includes("event: cell.updated"));
assert.ok(chunks[1].includes('"cellId":"cell-001"'));

request.emit("close");
const chunkCountAfterClose = chunks.length;
eventStream.publish("cell.updated", { cellId: "cell-002" });
assert.equal(chunks.length, chunkCountAfterClose);

console.log("HTTP event stream tests passed");
