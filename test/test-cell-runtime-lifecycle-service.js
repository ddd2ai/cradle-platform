import assert from "assert";
import { CellRuntimeLifecycleService } from "../src/cell/cell-runtime-lifecycle-service.js";

function createCell(overrides = {}) {
  const calls = [];
  const cell = {
    id: "cell-runtime",
    active: false,
    tickTimer: null,
    tickIntervalMs: 60_000,
    isTicking: false,
    assistant: {
      async cleanup() {
        calls.push({ type: "cleanup" });
      },
    },
    async updateStatus(status) {
      calls.push({ type: "updateStatus", status });
    },
    async readInbox() {
      calls.push({ type: "readInbox" });
      return [];
    },
    async processInbox(inbox) {
      calls.push({ type: "processInbox", inbox });
      return { processed: inbox.length };
    },
    async clearInbox() {
      calls.push({ type: "clearInbox" });
    },
    async nextPendingTask() {
      calls.push({ type: "nextPendingTask" });
      return null;
    },
    async processTask(task) {
      calls.push({ type: "processTask", task });
      return { ok: true };
    },
    async completeTask(taskId) {
      calls.push({ type: "completeTask", taskId });
    },
    async metabolize() {
      calls.push({ type: "metabolize" });
      return { created: 0 };
    },
    async evolve() {
      calls.push({ type: "evolve" });
      return { evolved: false };
    },
    ...overrides,
  };

  return { cell, calls };
}

{
  const { cell, calls } = createCell({
    async readInbox() {
      calls.push({ type: "readInbox" });
      return [{ id: "message-001" }];
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  const result = await service.tick();

  assert.deepEqual(result, {
    type: "inbox",
    processed: 1,
  });
  assert.equal(cell.isTicking, false);
  assert.deepEqual(
    calls.map((call) => call.type),
    ["readInbox", "updateStatus", "processInbox", "clearInbox", "updateStatus"]
  );
}

{
  const task = { id: "task-001" };
  const { cell, calls } = createCell({
    active: true,
    async nextPendingTask() {
      calls.push({ type: "nextPendingTask" });
      return task;
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  const result = await service.tick();

  assert.equal(result.type, "task");
  assert.equal(result.taskId, "task-001");
  assert.deepEqual(
    calls.filter((call) => call.type === "updateStatus").map((call) => call.status),
    ["running", "active"]
  );
  assert.equal(calls.find((call) => call.type === "completeTask").taskId, "task-001");
}

{
  const { cell } = createCell({
    async metabolize() {
      return { created: 2, observationFile: "observations/one.md" };
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  assert.deepEqual(await service.tick(), {
    type: "metabolism",
    processed: 2,
    observationFile: "observations/one.md",
  });
}

{
  const { cell } = createCell();
  const service = new CellRuntimeLifecycleService({ cell });

  assert.deepEqual(await service.tick(), {
    processed: 0,
    reason: "no inbox, task, or stimuli",
  });
}

{
  const { cell, calls } = createCell({
    async readInbox() {
      throw new Error("inbox unavailable");
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  await assert.rejects(() => service.tick(), /inbox unavailable/);
  assert.equal(cell.isTicking, false);
  assert.equal(calls.find((call) => call.type === "updateStatus").status, "error");
}

{
  const { cell, calls } = createCell({
    active: true,
    tickTimer: setInterval(() => {}, 60_000),
  });
  const service = new CellRuntimeLifecycleService({ cell });

  await service.shutdown();

  assert.equal(cell.active, false);
  assert.equal(cell.tickTimer, null);
  assert.deepEqual(
    calls.map((call) => call.type),
    ["updateStatus", "cleanup"]
  );
}

assert.throws(
  () => new CellRuntimeLifecycleService(),
  /requires cell/
);

console.log("CellRuntimeLifecycleService tests passed");
