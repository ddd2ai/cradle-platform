import assert from "node:assert/strict";
import { CancelOperationUseCase } from "../src/application/cancel-operation-use-case.js";
import { InMemoryOperationStore } from "../src/application/operation-store.js";
import { OperationRunner } from "../src/application/operation-runner.js";
import { CradleCell } from "../src/cradle-cell.js";
import { createApiHandler } from "../src/api/api-handler.js";

const events = [];
const store = new InMemoryOperationStore({
  eventBus: { publish: (type, payload) => events.push({ type, payload }) },
});
const runner = new OperationRunner({ operationStore: store });

let receivedSignal = null;
const running = runner.start({
  type: "stimulus-cultivation",
  context: { cellIds: ["cell-a"] },
  task: async ({ signal }) => {
    receivedSignal = signal;
    return await new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  },
});
await nextTurn();
assert.equal(store.get(running.operationId).status, "running");

const cancelling = new CancelOperationUseCase({
  operationStore: store,
  operationRunner: runner,
}).execute({ operationId: running.operationId });
assert.equal(cancelling.operation.status, "cancelling");
assert.equal(receivedSignal.aborted, true);
await nextTurn();

const cancelled = store.get(running.operationId);
assert.equal(cancelled.status, "cancelled");
assert.equal(cancelled.lifeState, "cancelled");
assert.equal(cancelled.currentStage, "cancelled");
assert.equal(cancelled.error, null);
assert.equal(cancelled.cancellation.reason, "Cancelled by user");
assert.ok(cancelled.cancelledAt);
assert.equal(events.some((event) =>
  event.type === "operation.updated" && event.payload.operation.status === "cancelled"
), true);

let acceptedTaskCalled = false;
const accepted = runner.start({
  type: "stimulus-cultivation",
  task: async () => {
    acceptedTaskCalled = true;
  },
});
runner.cancel(accepted.operationId);
await nextTurn();
assert.equal(acceptedTaskCalled, false);
assert.equal(store.get(accepted.operationId).status, "cancelled");

const completed = runner.start({
  type: "stimulus-cultivation",
  task: async () => ({ lifeState: "stable" }),
});
await nextTurn();
assert.equal(store.get(completed.operationId).status, "completed");
assert.equal(runner.cancel(completed.operationId).status, "completed");

const heartbeat = runner.start({ type: "heartbeat", task: async () => ({}) });
await assert.rejects(
  async () => new CancelOperationUseCase({ operationStore: store, operationRunner: runner })
    .execute({ operationId: heartbeat.operationId }),
  (error) => error.code === "OPERATION_NOT_CANCELLABLE" && error.status === 409,
);

await assert.rejects(
  async () => new CancelOperationUseCase({ operationStore: store, operationRunner: runner })
    .execute({ operationId: "op-missing" }),
  (error) => error.code === "OPERATION_NOT_FOUND" && error.status === 404,
);

const providerStarted = deferred();
const parentController = new AbortController();
let providerSignal = null;
const fakeCell = {
  id: "cell-a",
  provider: "codex",
  model: "auto",
  activeAiCalls: 0,
  runtimeMetrics: null,
  llmCallScheduler: null,
  ensureAssistant: async () => ({
    ask: async (_input, { signal }) => {
      providerSignal = signal;
      providerStarted.resolve();
      return await new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  }),
  applyPendingAiBinding: async () => {},
};
const providerCall = CradleCell.prototype.askWithTimeout.call(
  fakeCell,
  "hang",
  10_000,
  { signal: parentController.signal },
);
await providerStarted.promise;
const cancellation = Object.assign(new Error("stop now"), { code: "OPERATION_CANCELLED" });
parentController.abort(cancellation);
await assert.rejects(providerCall, (error) => error === cancellation);
assert.equal(providerSignal.aborted, true);

const apiStore = new InMemoryOperationStore();
const apiRunner = new OperationRunner({ operationStore: apiStore });
const apiOperation = apiRunner.start({
  type: "stimulus-cultivation",
  task: async ({ signal }) => await new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }),
});
await nextTurn();
const apiHandler = createApiHandler({
  engine: {
    projectRoot: "/tmp/cradle-operation-cancellation-test",
    syncCellsFromDisk: async () => {},
  },
  operationStore: apiStore,
  operationRunner: apiRunner,
});
const apiResponse = await apiHandler({
  method: "POST",
  url: `/api/v1/operations/${apiOperation.operationId}/cancel`,
  headers: {},
});
assert.equal(apiResponse.status, 200);
assert.equal(apiResponse.body.operation.status, "cancelling");
await nextTurn();
assert.equal(apiStore.get(apiOperation.operationId).status, "cancelled");

console.log("Operation cancellation tests passed");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}
