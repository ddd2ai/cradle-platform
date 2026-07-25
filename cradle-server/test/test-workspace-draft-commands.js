import assert from "assert";
import { createWorkspaceDraftCommands } from "../src/commands/workspace-draft-commands.js";

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
  const writes = [];
  const cell = {
    ask: async () => ({ text: "```markdown\ncreated content\n```" }),
    writeWorkspaceFile: async (fileName, content) => writes.push({ fileName, content }),
  };

  return {
    writes,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
    formatTimestamp: () => "20260724T100000",
    cleanMarkdownFence: (text) => text.replace(/^```markdown\n/, "").replace(/\n```$/, ""),
  };
}

const commands = createWorkspaceDraftCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/write"]
);

const writeCommand = commands[0];
assert.equal(writeCommand.match("/write draft", { engine: createEngine() }), true);
assert.equal(
  writeCommand.match("/write draft", { engine: createEngine({ cradleMode: true }) }),
  false
);

const writeEngine = createEngine();
const writeOutput = await captureConsoleAsync(() =>
  writeCommand.execute({ engine: writeEngine, input: "/write draft" })
);
assert.equal(writeEngine.writes[0].fileName, "artifacts/note-20260724T100000.md");
assert.equal(writeEngine.writes[0].content, "created content");
assert.ok(writeOutput.includes("Workspace file created: artifacts/note-20260724T100000.md"));

const usageOutput = await captureConsoleAsync(() =>
  writeCommand.execute({ engine: createEngine(), input: "/write " })
);
assert.equal(usageOutput, "Usage: /write <task>");

console.log("Workspace draft command tests passed");
