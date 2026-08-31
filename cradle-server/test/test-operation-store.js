import assert from "assert";
import { InMemoryOperationStore } from "../src/application/operation-store.js";

const events = [];
const store = new InMemoryOperationStore({
  limit: 2,
  eventBus: {
    publish(type, payload) {
      events.push({ type, payload });
    },
  },
});

const first = store.create({ type: "heartbeat" });
store.update(first.operationId, {
  status: "completed",
  result: { snapshot: { cells: Array.from({ length: 100 }, (_, index) => index) } },
});

const terminalEvent = events.findLast(
  (event) => event.type === "operation.updated" && event.payload.operation.status === "completed"
);
assert.equal("result" in terminalEvent.payload.operation, false);
assert.equal(store.get(first.operationId).result.snapshot.cells.length, 100);

store.create({ type: "cell-division" });
store.create({ type: "cell-fusion" });
assert.equal(store.list().length, 2);
assert.equal(store.get(first.operationId), null);

console.log("Operation store tests passed");
