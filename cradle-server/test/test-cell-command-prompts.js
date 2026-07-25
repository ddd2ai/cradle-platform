import assert from "assert";
import {
  createInboxDigestPrompt,
  createPerceptionPrompt,
  createTaskArtifactPrompt,
  createWorkspaceRevisionPrompt,
  createWorkspaceWritePrompt,
} from "../src/commands/cell-command-prompts.js";

const perception = createPerceptionPrompt({
  memoryContext: "cell memory",
  stimuli: [
    {
      category: "notes",
      file: "brief.md",
      content: "new signal",
    },
  ],
});
assert.ok(perception.includes("Cell Context"));
assert.ok(perception.includes("cell memory"));
assert.ok(perception.includes("## notes/brief.md"));
assert.ok(perception.includes("new signal"));

const write = createWorkspaceWritePrompt("draft plan");
assert.ok(write.includes("draft plan"));
assert.ok(write.includes("請只輸出 Markdown 內容"));

const revision = createWorkspaceRevisionPrompt({
  task: "tighten scope",
  originalContent: "# Old",
});
assert.ok(revision.includes("tighten scope"));
assert.ok(revision.includes("# Old"));
assert.ok(revision.includes("不要新增目前系統尚未實作的能力"));

const digest = createInboxDigestPrompt([
  {
    from: "cell-001",
    content: "status",
  },
]);
assert.ok(digest.includes("請整理以下 inbox 訊息"));
assert.ok(digest.includes('"from": "cell-001"'));

const task = createTaskArtifactPrompt({
  id: "task-001",
  title: "Draft artifact",
});
assert.ok(task.includes("Task"));
assert.ok(task.includes('"id": "task-001"'));
assert.ok(task.includes("請只輸出 Markdown"));

console.log("Cell command prompt tests passed");
