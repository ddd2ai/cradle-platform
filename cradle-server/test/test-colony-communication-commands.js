import assert from "assert";
import { createColonyCommunicationCommands } from "../src/commands/colony-communication-commands.js";

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

function createEngine() {
  const asks = [];
  const messages = [];
  const cells = new Map([
    ["cell-001", {
      ask: async (message) => asks.push({ cellId: "cell-001", message }),
    }],
    ["cell-002", {
      ask: async (message) => asks.push({ cellId: "cell-002", message }),
    }],
  ]);

  return {
    activeCellId: "cell-001",
    asks,
    messages,
    cells,
    pushMessage: async (message) => messages.push(message),
  };
}

const commands = createColonyCommunicationCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/ask", "/broadcast", "/run-all"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/ask").match("/ask cell-001 hello"), true);
assert.equal(byName.get("/broadcast").match("/broadcast hello"), true);
assert.equal(byName.get("/run-all").match("/run-all do work"), true);

const askEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/ask").execute({
    engine: askEngine,
    input: "/ask cell-002 hello there",
  })
);
assert.deepEqual(askEngine.asks, [
  {
    cellId: "cell-002",
    message: "hello there",
  },
]);

const missingAskOutput = await captureConsoleAsync(() =>
  byName.get("/ask").execute({
    engine: createEngine(),
    input: "/ask cell-404 hello",
  })
);
assert.equal(missingAskOutput, "Cell not found: cell-404");

const broadcastEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/broadcast").execute({
    engine: broadcastEngine,
    input: "/broadcast all hands",
  })
);
assert.deepEqual(broadcastEngine.messages, [
  {
    from: "cell-001",
    to: "cell-001",
    type: "broadcast",
    content: "all hands",
  },
  {
    from: "cell-001",
    to: "cell-002",
    type: "broadcast",
    content: "all hands",
  },
]);

const runAllEngine = createEngine();
const runAllOutput = await captureConsoleAsync(() =>
  byName.get("/run-all").execute({
    engine: runAllEngine,
    input: "/run-all summarize status",
  })
);
assert.equal(runAllEngine.asks.length, 2);
assert.ok(runAllEngine.asks[0].message.includes("summarize status"));
assert.ok(runAllOutput.includes("========== cell-001 =========="));

const usageOutput = await captureConsoleAsync(() =>
  byName.get("/broadcast").execute({
    engine: createEngine(),
    input: "/broadcast ",
  })
);
assert.equal(usageOutput, "Usage: /broadcast <message>");

console.log("Colony communication command tests passed");
