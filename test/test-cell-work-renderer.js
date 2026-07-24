import assert from "assert";
import {
  renderEvolutionResult,
  renderInbox,
  renderInboxProcessResult,
  renderMetabolismResult,
  renderTaskList,
} from "../src/commands/cell-work-renderer.js";

function captureConsole(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return output.join("\n");
}

assert.ok(captureConsole(() => renderInbox([])).includes("(empty inbox)"));

const inbox = captureConsole(() => {
  renderInbox([
    {
      type: "message",
      createdAt: "2026-07-24T10:00:00.000Z",
      from: "cell-001",
      to: "cell-002",
      content: "Please review this.",
    },
  ]);
});
assert.ok(inbox.includes("[message] 2026-07-24T10:00:00.000Z"));
assert.ok(inbox.includes("From: cell-001"));
assert.ok(inbox.includes("Please review this."));

const metabolism = captureConsole(() => {
  renderMetabolismResult({
    created: 2,
    observationFile: "observation.md",
    reason: "new stimuli",
  });
});
assert.ok(metabolism.includes("Metabolism completed."));
assert.ok(metabolism.includes("Created tasks : 2"));
assert.ok(metabolism.includes("Observation   : observation.md"));

const metabolismFallback = captureConsole(() => {
  renderMetabolismResult({
    created: 0,
  });
});
assert.ok(metabolismFallback.includes("Observation   : -"));
assert.ok(metabolismFallback.includes("Reason        : -"));

const evolved = captureConsole(() => {
  renderEvolutionResult({
    evolved: true,
    file: "evolution.md",
    thoughtCount: 3,
    dnaDrift: ["CREATION"],
  });
});
assert.ok(evolved.includes("Evolution completed."));
assert.ok(evolved.includes("File         : evolution.md"));
assert.ok(evolved.includes("DNA drift    : 1"));

const skipped = captureConsole(() => {
  renderEvolutionResult({
    evolved: false,
    reason: "not enough thoughts",
    thoughtCount: 1,
  });
});
assert.ok(skipped.includes("Evolution skipped."));
assert.ok(skipped.includes("Reason       : not enough thoughts"));

const processed = captureConsole(() => {
  renderInboxProcessResult({
    processed: 4,
    summary: "Created two tasks.",
  });
});
assert.ok(processed.includes("Inbox processed."));
assert.ok(processed.includes("4"));
assert.ok(processed.includes("Created two tasks."));

assert.ok(captureConsole(() => renderTaskList([])).includes("(no tasks)"));

const tasks = captureConsole(() => {
  renderTaskList([
    {
      status: "pending",
      id: "task-001",
      title: "Draft artifact",
      source: "stimulus",
    },
  ]);
});
assert.ok(tasks.includes("[pending] task-001"));
assert.ok(tasks.includes("Draft artifact"));
assert.ok(tasks.includes("source: stimulus"));

console.log("Cell work renderer tests passed");
