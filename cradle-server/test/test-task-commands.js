import assert from "assert";
import { createTaskCommands } from "../src/commands/task-commands.js";

function captureConsoleAsync(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  return Promise.resolve()
    .then(fn)
    .then(() => output.join("\n"))
    .finally(() => {
      console.log = originalLog;
    });
}

function createEngine({ cradleMode = false, task = null, tasks = [] } = {}) {
  const writes = [];
  const completed = [];
  const cell = {
    readTasks: async () => tasks,
    nextPendingTask: async () => task,
    ask: async () => ({ text: "```markdown\nartifact content\n```" }),
    writeWorkspaceFile: async (fileName, content) => writes.push({ fileName, content }),
    completeTask: async (taskId) => completed.push(taskId),
  };

  return {
    writes,
    completed,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
    cleanMarkdownFence: (text) => text.replace(/^```markdown\n/, "").replace(/\n```$/, ""),
  };
}

const commands = createTaskCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/tasks", "/do"]
);

const byName = new Map(commands.map((command) => [command.name, command]));

assert.equal(byName.get("/tasks").match("/tasks", { engine: createEngine() }), true);
assert.equal(
  byName.get("/tasks").match("/tasks", { engine: createEngine({ cradleMode: true }) }),
  false
);

const tasksOutput = await captureConsoleAsync(() =>
  byName.get("/tasks").execute({
    engine: createEngine({
      tasks: [
        {
          status: "pending",
          id: "task-001",
          title: "Draft artifact",
          source: "inbox",
        },
      ],
    }),
  })
);
assert.ok(tasksOutput.includes("[pending] task-001"));
assert.ok(tasksOutput.includes("Draft artifact"));

const emptyTasksOutput = await captureConsoleAsync(() =>
  byName.get("/tasks").execute({ engine: createEngine() })
);
assert.equal(emptyTasksOutput, "(no tasks)");

const doEngine = createEngine({
  task: {
    id: "task-001",
    title: "Draft artifact",
  },
});
const doOutput = await captureConsoleAsync(() =>
  byName.get("/do").execute({ engine: doEngine })
);
assert.equal(doEngine.writes[0].fileName, "artifacts/task-001.md");
assert.equal(doEngine.writes[0].content, "artifact content");
assert.deepEqual(doEngine.completed, ["task-001"]);
assert.ok(doOutput.includes("Artifact created: artifacts/task-001.md"));

const emptyDoOutput = await captureConsoleAsync(() =>
  byName.get("/do").execute({ engine: createEngine() })
);
assert.equal(emptyDoOutput, "(no pending task)");

console.log("Task command tests passed");
