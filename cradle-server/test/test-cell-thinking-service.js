import assert from "node:assert/strict";
import { CellThinkingService } from "../src/cell/cell-thinking-service.js";

function createCell() {
  const calls = [];
  return {
    calls,
    name: "Payment Cell",
    async getProfile() { return { responsibilities: ["payments"] }; },
    async buildOperationalContext() { return "current operation"; },
    async askWithTimeout(prompt, timeoutMs) {
      calls.push({ type: "ask", prompt, timeoutMs });
      return {
        answer: JSON.stringify({
          observation: {
            summary: "Payment report received",
            facts: ["retry count is 2"],
            interpretations: [],
            unknowns: ["root cause"],
          },
          tasks: [],
        }),
      };
    },
    async appendThought(content) { calls.push({ type: "thought", content }); },
    async appendKnowledge(content) { calls.push({ type: "knowledge", content }); },
    async addTask(task) {
      calls.push({ type: "task", task });
      return { id: `task-${calls.filter((call) => call.type === "task").length}`, ...task };
    },
  };
}

{
  const cell = createCell();
  const service = new CellThinkingService({ cell });
  const result = await service.processInbox([{
    id: "msg-delegation",
    type: "delegation",
    from: "order-cell",
    content: "Verify payment idempotency",
    createdAt: "2026-09-04T08:00:00.000Z",
  }]);

  assert.equal(result.processed, 1);
  assert.equal(result.tasksCreated, 1);
  assert.equal(result.llmCalls, 0);
  assert.equal(cell.calls.some((call) => call.type === "ask"), false);
  assert.match(cell.calls.find((call) => call.type === "task").task.title, /Verify payment idempotency/);
  assert.match(cell.calls.find((call) => call.type === "task").task.content, /msg-delegation/);
}

{
  const cell = createCell();
  const service = new CellThinkingService({ cell });
  const result = await service.processInbox([{
    id: "msg-report",
    type: "report",
    from: "order-cell",
    content: "retry count is 2",
  }]);

  assert.equal(result.tasksCreated, 0);
  assert.equal(result.llmCalls, 1);
  assert.equal(cell.calls.filter((call) => call.type === "ask").length, 1);
  assert.equal(cell.calls.find((call) => call.type === "ask").timeoutMs, 60_000);
  assert.match(cell.calls.find((call) => call.type === "knowledge").content, /msg-report/);
  assert.equal(cell.calls.some((call) => call.type === "task"), false);
}

{
  const cell = createCell();
  cell.askWithTimeout = async () => ({
    answer: JSON.stringify({
      observation: { summary: "Explicit work requested" },
      tasks: [{ title: "Check retry policy", content: "Compare policy with report" }],
    }),
  });
  const result = await new CellThinkingService({ cell }).processInbox([{
    id: "msg-action",
    type: "message",
    from: "order-cell",
    content: "Please check retry policy",
  }]);
  assert.equal(result.tasksCreated, 1);
  assert.equal(result.tasks[0].source, "inbox");
}

console.log("Cell thinking service tests passed");
