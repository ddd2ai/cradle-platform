import assert from "assert";
import { createWorkspaceListCommands } from "../src/commands/workspace-list-commands.js";

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

function createEngine({ cradleMode = false } = {}) {
  const cell = {
    listWorkspaceSections: async () => ({
      notes: ["source.md"],
      decisions: [],
    }),
  };

  return {
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const commands = createWorkspaceListCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/workspace"]
);

const workspaceCommand = commands[0];
assert.equal(workspaceCommand.match("/workspace", { engine: createEngine() }), true);
assert.equal(
  workspaceCommand.match("/workspace", { engine: createEngine({ cradleMode: true }) }),
  false
);

const output = await captureConsoleAsync(() =>
  workspaceCommand.execute({ engine: createEngine() })
);
assert.ok(output.includes("Workspace"));
assert.ok(output.includes("notes/"));

console.log("Workspace list command tests passed");
