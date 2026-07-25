import assert from "assert";
import { CellTaskProcessingService } from "../src/cell/cell-task-processing-service.js";

const calls = [];
const cell = {
  id: "cell-task",
  formatTimestamp: () => "20260724-120000",
  async askWithTimeout(input, timeoutMs) {
    calls.push({ type: "askWithTimeout", input, timeoutMs });
    return { text: "task done" };
  },
  async writeWorkspaceFile(file, content) {
    calls.push({ type: "writeWorkspaceFile", file, content });
  },
  async appendHistory(content) {
    calls.push({ type: "appendHistory", content });
  },
  async appendThought(content) {
    calls.push({ type: "appendThought", content });
  },
  async mature(amount) {
    calls.push({ type: "mature", amount });
  },
};

const service = new CellTaskProcessingService({ cell });

const result = await service.processTask({
  id: "task-001",
  title: "Verify task flow",
  source: "manual",
  content: "Check all side effects",
});

assert.deepEqual(result, {
  file: "tasks/task-result-20260724-120000.md",
  text: "task done",
});

const askCall = calls.find((call) => call.type === "askWithTimeout");
assert.ok(askCall.input.includes("Verify task flow"));
assert.ok(askCall.input.includes("Check all side effects"));
assert.equal(askCall.timeoutMs, 3_600_000);

const writeCall = calls.find((call) => call.type === "writeWorkspaceFile");
assert.equal(writeCall.file, "tasks/task-result-20260724-120000.md");
assert.ok(writeCall.content.includes("task-001"));
assert.ok(writeCall.content.includes("task done"));

assert.ok(
  calls.find((call) => call.type === "appendHistory").content.includes("task done")
);
assert.ok(
  calls.find((call) => call.type === "appendThought").content.includes("manual")
);
assert.deepEqual(
  calls.map((call) => call.type),
  [
    "askWithTimeout",
    "writeWorkspaceFile",
    "appendHistory",
    "appendThought",
    "mature",
  ]
);

assert.throws(
  () => new CellTaskProcessingService(),
  /requires cell/
);

console.log("CellTaskProcessingService tests passed");
