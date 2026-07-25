import assert from "assert";
import {
  buildEngineStatusRows,
  createEngineStatusCommands,
  renderCellIdentity,
  renderCradleIdentity,
} from "../src/commands/engine-status-commands.js";

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

async function captureConsoleAsync(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  try {
    await fn();
  } finally {
    console.log = originalLog;
  }

  return output.join("\n");
}

function createEngine({ cradleMode = true } = {}) {
  const cell = {
    id: "cell-001",
    name: "Planner",
    model: "test-model",
    getEvolutionInfo: async () => ({
      status: "active",
      generation: 2,
    }),
    getMaturityInfo: async () => ({
      percent: 80,
      state: "stable",
      temporalVariance: 0.01234,
      convergence: 0.987,
    }),
    getLifecycleDecision: async () => ({
      action: "stay",
    }),
    isActive: () => true,
  };

  return {
    model: "engine-model",
    cells: new Map([["cell-001", cell]]),
    inboxes: new Map([["cell-001", [{ content: "hello" }]]]),
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const rows = await buildEngineStatusRows(createEngine());
assert.deepEqual(rows, [
  {
    Cell: "cell-001",
    Status: "active",
    Active: "yes",
    Mature: "80%",
    Life: "stay",
    State: "stable",
    Var: "0.0123",
    Conv: "0.99",
    Gen: 2,
    Inbox: 1,
  },
]);

const cradle = captureConsole(() => renderCradleIdentity(createEngine()));
assert.ok(cradle.includes("Mode      : Cradle"));
assert.ok(cradle.includes("Model     : engine-model"));

const cellIdentity = captureConsole(() => {
  renderCellIdentity({
    cell: createEngine({ cradleMode: false }).getActiveCell(),
    inboxCount: 1,
  });
});
assert.ok(cellIdentity.includes("Cell ID   : cell-001"));
assert.ok(cellIdentity.includes("Inbox     : 1"));

const commands = createEngineStatusCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/status", "/whoami"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/status").match("/status"), true);
assert.equal(byName.get("/whoami").match("/whoami"), true);

const statusOutput = await captureConsoleAsync(() =>
  byName.get("/status").execute({ engine: createEngine() })
);
assert.ok(statusOutput.includes("cell-001"));
assert.ok(statusOutput.includes("active"));

const whoamiOutput = await captureConsoleAsync(() =>
  byName.get("/whoami").execute({ engine: createEngine({ cradleMode: false }) })
);
assert.ok(whoamiOutput.includes("Cell ID   : cell-001"));

console.log("Engine status command tests passed");
