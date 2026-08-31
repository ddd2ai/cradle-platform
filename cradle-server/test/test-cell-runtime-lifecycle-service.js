import assert from "assert";
import { CellRuntimeLifecycleService } from "../src/cell/cell-runtime-lifecycle-service.js";

function createCell(overrides = {}) {
  const calls = [];
  const cell = {
    id: "cell-runtime",
    active: false,
    tickTimer: null,
    summaryFlushTimer: null,
    summaryFlushRequested: false,
    isSummaryFlushing: false,
    summaryFlushDelayMs: 1,
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
  let summaryFlushes = 0;
  const { cell, calls } = createCell({
    active: true,
    metabolismService: {
      async metabolize(options) {
        summaryFlushes += 1;
        calls.push({ type: "summaryMetabolize", options });
        return { consumed: 3, processing: "summary-only" };
      },
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  service.requestSummaryFlush("passive-1");
  service.requestSummaryFlush("passive-2");
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(summaryFlushes, 1);
  assert.deepEqual(
    calls.find((call) => call.type === "summaryMetabolize").options,
    { summaryOnly: true }
  );
  assert.equal(
    calls.some((call) => call.type === "readInbox"),
    false,
    "summary flush must not enter the full Cell activation flow"
  );
}

{
  let releaseSummary;
  const releaseSummaryPromise = new Promise((resolve) => { releaseSummary = resolve; });
  const { cell, calls } = createCell({
    active: true,
    metabolismService: {
      async metabolize() {
        await releaseSummaryPromise;
        return { consumed: 1, processing: "summary-only" };
      },
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  service.requestSummaryFlush("passive");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(cell.isSummaryFlushing, true);
  service.requestActivation("actionable-during-summary");
  await Promise.resolve();
  assert.equal(
    calls.some((call) => call.type === "readInbox"),
    false,
    "activation must wait for the deterministic summary critical section"
  );
  releaseSummary();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls.filter((call) => call.type === "readInbox").length, 1);
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
  assert.equal(result.workRemains, true);
  assert.deepEqual(
    calls.filter((call) => call.type === "updateStatus").map((call) => call.status),
    ["running", "active"]
  );
  assert.equal(calls.find((call) => call.type === "completeTask").taskId, "task-001");
}

{
  let releaseTask;
  let taskStarted;
  const task = { id: "task-wait" };
  const taskStartedPromise = new Promise((resolve) => {
    taskStarted = resolve;
  });
  const releaseTaskPromise = new Promise((resolve) => {
    releaseTask = resolve;
  });
  const { cell } = createCell({
    active: true,
    async nextPendingTask() {
      return task;
    },
    async processTask() {
      taskStarted();
      await releaseTaskPromise;
      return { ok: true };
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });
  const tickPromise = service.tick();

  await taskStartedPromise;
  assert.equal(cell.isTicking, true);
  assert.equal(service.getActiveTick().cellId, "cell-runtime");

  let waitCompleted = false;
  const waitPromise = service.waitForActiveTick().then(() => {
    waitCompleted = true;
  });

  await Promise.resolve();
  assert.equal(waitCompleted, false);

  releaseTask();
  await tickPromise;
  await waitPromise;

  assert.equal(waitCompleted, true);
  assert.equal(cell.isTicking, false);
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
    workRemains: false,
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
  const { cell, calls } = createCell();
  const service = new CellRuntimeLifecycleService({ cell });

  await service.activate();
  service.requestActivation("duplicate-wakeup");
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(cell.active, true);
  assert.equal(cell.tickTimer, null);
  assert.equal(
    calls.filter((call) => call.type === "readInbox").length,
    1,
    "coalesced wakeups should run one idle tick without a polling timer"
  );
  await service.deactivate();
}

{
  let inboxReads = 0;
  const { cell } = createCell({
    async readInbox() {
      inboxReads += 1;
      return inboxReads === 1 ? [{ id: "message-once" }] : [];
    },
  });
  const service = new CellRuntimeLifecycleService({ cell });

  await service.activate();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(
    inboxReads,
    1,
    "productive work should not cause a speculative empty activation"
  );
  await service.deactivate();
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
