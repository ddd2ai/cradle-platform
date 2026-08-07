import assert from "node:assert/strict";
import {
  ApplicationEventStream,
  createApplicationEventResponse,
  formatServerSentEvent,
} from "../src/application/application-event-stream.js";

const stream = new ApplicationEventStream({
  historyLimit: 2,
  now: () => new Date("2026-08-07T05:00:00.000Z"),
});
const received = [];
const unsubscribe = stream.subscribe((event) => received.push(event));

const first = stream.publish("cell.updated", { cellId: "cell-001" });
stream.publish("operation.updated", { operation: { operationId: "op-1" } });
unsubscribe();
stream.publish("log.appended", { entry: { id: 1, message: "done" } });

assert.equal(first.id, "1");
assert.deepEqual(received.map((event) => event.type), [
  "cell.updated",
  "operation.updated",
]);

const replayed = [];
const stopReplay = stream.subscribe((event) => replayed.push(event), {
  afterEventId: "1",
});
stopReplay();
assert.deepEqual(replayed.map((event) => event.id), ["2", "3"]);

let deliveredAfterSubscriberFailure = false;
stream.subscribe(() => {
  throw new Error("subscriber failed");
});
stream.subscribe(() => {
  deliveredAfterSubscriberFailure = true;
});
stream.publish("cell.updated", { cellId: "cell-safe" });
assert.equal(deliveredAfterSubscriberFailure, true);

const encoded = formatServerSentEvent(first);
assert.ok(encoded.includes("id: 1"));
assert.ok(encoded.includes("event: cell.updated"));
assert.ok(encoded.includes('"cellId":"cell-001"'));

const chunks = [];
const response = createApplicationEventResponse({ eventStream: stream });
const disconnect = response.subscribe((chunk) => chunks.push(chunk));
stream.publish("cell.created", { cellId: "cell-002" });
disconnect();

assert.equal(response.status, 200);
assert.equal(response.headers["content-type"], "text/event-stream; charset=utf-8");
assert.equal(chunks[0], ": connected\n\n");
assert.ok(chunks[1].includes("event: cell.created"));

console.log("Application event stream tests passed");
