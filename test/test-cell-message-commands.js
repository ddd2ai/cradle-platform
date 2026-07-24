import assert from "assert";
import { createCellMessageCommands } from "../src/commands/cell-message-commands.js";

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
  const relationships = [];
  const writes = [];
  const messages = [];
  const activeCell = {
    id: "cell-001",
    addRelationship: async (type, target) => relationships.push({ type, target }),
    writeWorkspaceFile: async (fileName, content) => writes.push({ fileName, content }),
    readWorkspaceFile: async (fileName) => {
      if (fileName !== "artifacts/result.md") {
        throw new Error("missing");
      }

      return "result content";
    },
  };

  return {
    relationships,
    writes,
    messages,
    cells: new Map([
      [activeCell.id, activeCell],
      ["cell-002", { id: "cell-002" }],
    ]),
    isCradleMode: () => cradleMode,
    getActiveCell: () => activeCell,
    pushMessage: async (message) => messages.push(message),
    formatTimestamp: () => "20260724T100000",
  };
}

const commands = createCellMessageCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/delegate", "/report"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/delegate").match("/delegate cell-002 draft", { engine: createEngine() }), true);
assert.equal(
  byName.get("/delegate").match("/delegate cell-002 draft", { engine: createEngine({ cradleMode: true }) }),
  false
);

const delegateEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/delegate").execute({
    engine: delegateEngine,
    input: "/delegate cell-002 draft plan",
  })
);
assert.deepEqual(delegateEngine.messages[0], {
  from: "cell-001",
  to: "cell-002",
  type: "delegation",
  content: "draft plan",
});
assert.deepEqual(delegateEngine.relationships[0], {
  type: "delegated-to",
  target: "cell-002",
});
assert.equal(delegateEngine.writes[0].fileName, "decisions/delegation-20260724T100000.md");

const missingDelegateTargetOutput = await captureConsoleAsync(() =>
  byName.get("/delegate").execute({
    engine: createEngine(),
    input: "/delegate missing-cell draft plan",
  })
);
assert.equal(missingDelegateTargetOutput, "Target cell not found: missing-cell");

const reportEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/report").execute({
    engine: reportEngine,
    input: "/report cell-002 artifacts/result.md",
  })
);
assert.equal(reportEngine.messages[0].type, "report");
assert.ok(reportEngine.messages[0].content.includes("artifacts/result.md"));
assert.deepEqual(reportEngine.relationships[0], {
  type: "reported-to",
  target: "cell-002",
});

const missingReportOutput = await captureConsoleAsync(() =>
  byName.get("/report").execute({
    engine: createEngine(),
    input: "/report cell-002 missing.md",
  })
);
assert.equal(missingReportOutput, "Workspace file not found: missing.md");

console.log("Cell message command tests passed");
