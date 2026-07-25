import assert from "assert";
import { createWorkspaceRecordCommands } from "../src/commands/workspace-record-commands.js";

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
    writeWorkspaceFile: async (fileName, content) => writes.push({ fileName, content }),
  };

  return {
    writes,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
    formatTimestamp: () => "20260724T100000",
  };
}

const commands = createWorkspaceRecordCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/write-note", "/decide", "/research"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/write-note").match("/write-note remember", { engine: createEngine() }), true);
assert.equal(
  byName.get("/write-note").match("/write-note remember", { engine: createEngine({ cradleMode: true }) }),
  false
);

const noteEngine = createEngine();
const noteOutput = await captureConsoleAsync(() =>
  byName.get("/write-note").execute({
    engine: noteEngine,
    input: "/write-note remember this",
  })
);
assert.equal(noteEngine.writes[0].fileName, "notes/note-20260724T100000.md");
assert.ok(noteEngine.writes[0].content.includes("remember this"));
assert.ok(noteOutput.includes("Note created: notes/note-20260724T100000.md"));

const decisionEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/decide").execute({
    engine: decisionEngine,
    input: "/decide choose sqlite",
  })
);
assert.equal(decisionEngine.writes[0].fileName, "decisions/decision-20260724T100000.md");
assert.ok(decisionEngine.writes[0].content.includes("choose sqlite"));

const researchEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/research").execute({
    engine: researchEngine,
    input: "/research prompt caching notes",
  })
);
assert.equal(researchEngine.writes[0].fileName, "research/research-20260724T100000.md");
assert.ok(researchEngine.writes[0].content.includes("prompt caching notes"));

const usageOutput = await captureConsoleAsync(() =>
  byName.get("/write-note").execute({
    engine: createEngine(),
    input: "/write-note ",
  })
);
assert.equal(usageOutput, "Usage: /write-note <content>");

console.log("Workspace record command tests passed");
