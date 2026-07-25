import assert from "assert";
import { createCellCollaborationCommands } from "../src/commands/cell-collaboration-commands.js";

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
  const responsibilities = ["research"];
  const relationships = [
    { type: "depends-on", target: "cell-002" },
  ];
  const writes = [];
  const messages = [];
  const knowledge = [];
  const activeCell = {
    id: "cell-001",
    addResponsibility: async (name) => responsibilities.push(name),
    listResponsibilities: async () => responsibilities,
    addRelationship: async (type, target) => relationships.push({ type, target }),
    listRelationships: async () => relationships,
    getProfile: async () => ({
      id: "cell-001",
      relationships,
    }),
    calculateConvergence: async () => 0.75,
    appendKnowledge: async (content) => knowledge.push(content),
    writeWorkspaceFile: async (fileName, content) => writes.push({ fileName, content }),
    readWorkspaceFile: async (fileName) => {
      if (fileName !== "artifacts/result.md") {
        throw new Error("missing");
      }

      return "result content";
    },
  };

  return {
    responsibilities,
    relationships,
    writes,
    messages,
    knowledge,
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

const commands = createCellCollaborationCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  [
    "/resp",
    "/link",
    "/profile",
    "/specialize",
    "/graph",
    "/delegate",
    "/report",
    "/trace",
  ]
);

const byName = new Map(commands.map((command) => [command.name, command]));

assert.equal(byName.get("/resp").match("/resp list", { engine: createEngine() }), true);
assert.equal(
  byName.get("/resp").match("/resp list", { engine: createEngine({ cradleMode: true }) }),
  false
);

const respEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/resp").execute({ engine: respEngine, input: "/resp add writing" })
);
assert.ok(respEngine.responsibilities.includes("writing"));

const respListOutput = await captureConsoleAsync(() =>
  byName.get("/resp").execute({ engine: respEngine, input: "/resp list" })
);
assert.ok(respListOutput.includes("research"));
assert.ok(respListOutput.includes("writing"));

const linkEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/link").execute({ engine: linkEngine, input: "/link supports cell-003" })
);
assert.deepEqual(linkEngine.relationships.at(-1), {
  type: "supports",
  target: "cell-003",
});

const profileOutput = await captureConsoleAsync(() =>
  byName.get("/profile").execute({ engine: createEngine() })
);
assert.ok(profileOutput.includes('"convergence": 0.75'));

const specializeEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/specialize").execute({
    engine: specializeEngine,
    input: "/specialize planning",
  })
);
assert.ok(specializeEngine.responsibilities.includes("planning"));
assert.ok(specializeEngine.knowledge[0].includes("planning"));

const graphOutput = await captureConsoleAsync(() =>
  byName.get("/graph").execute({ engine: createEngine() })
);
assert.ok(graphOutput.includes("cell-001"));
assert.ok(graphOutput.includes("depends-on -> cell-002"));

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
assert.deepEqual(delegateEngine.relationships.at(-1), {
  type: "delegated-to",
  target: "cell-002",
});
assert.equal(delegateEngine.writes[0].fileName, "decisions/delegation-20260724T100000.md");

const reportEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/report").execute({
    engine: reportEngine,
    input: "/report cell-002 artifacts/result.md",
  })
);
assert.equal(reportEngine.messages[0].type, "report");
assert.ok(reportEngine.messages[0].content.includes("artifacts/result.md"));
assert.deepEqual(reportEngine.relationships.at(-1), {
  type: "reported-to",
  target: "cell-002",
});

const missingReportOutput = await captureConsoleAsync(() =>
  byName.get("/report").execute({
    engine: createEngine(),
    input: "/report cell-002 missing.md",
  })
);
assert.ok(missingReportOutput.includes("Workspace file not found: missing.md"));

const traceOutput = await captureConsoleAsync(() =>
  byName.get("/trace").execute({ engine: createEngine() })
);
assert.ok(traceOutput.includes("Trace: cell-001"));
assert.ok(traceOutput.includes("cell-001 --depends-on--> cell-002"));

console.log("Cell collaboration command tests passed");
