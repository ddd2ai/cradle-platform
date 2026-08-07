import assert from "assert";
import {
  buildCellStatusRow,
  buildCellsStatusRows,
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

function createCell({ id, name, status = "active" }) {
  return {
    id,
    name,
    model: "test-model",
    getEvolutionInfo: async () => ({
      status,
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
}

function createEngine({ cradleMode = true, multipleCells = false } = {}) {
  const cell = createCell({ id: "cell-001", name: "Planner" });
  const cells = new Map([[cell.id, cell]]);
  const inboxes = new Map([[cell.id, [{ content: "hello" }]]]);

  if (multipleCells) {
    const otherCell = createCell({
      id: "cell-002",
      name: "Builder",
      status: "idle",
    });
    cells.set(otherCell.id, otherCell);
    inboxes.set(otherCell.id, []);
  }

  return {
    model: "engine-model",
    cells,
    inboxes,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const rows = await buildCellsStatusRows(createEngine());
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

const cellRow = await buildCellStatusRow(
  createEngine({ cradleMode: false }),
  createEngine({ cradleMode: false }).getActiveCell()
);
assert.deepEqual(cellRow, rows[0]);

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
  ["/cells", "/status", "/whoami"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
const cradleEngine = createEngine({ multipleCells: true });
const cellEngine = createEngine({ cradleMode: false, multipleCells: true });

assert.equal(
  byName.get("/cells").match("/cells", { engine: cradleEngine }),
  true
);
assert.equal(
  byName.get("/cells").match("/cells", { engine: cellEngine }),
  false
);
assert.equal(
  byName.get("/status").match("/status", { engine: cradleEngine }),
  false
);
assert.equal(
  byName.get("/status").match("/status", { engine: cellEngine }),
  true
);
assert.equal(byName.get("/whoami").match("/whoami"), true);

const cellsStatusOutput = await captureConsoleAsync(() =>
  byName.get("/cells").execute({ engine: cradleEngine })
);
assert.ok(cellsStatusOutput.includes("cell-001"));
assert.ok(cellsStatusOutput.includes("cell-002"));
assert.ok(cellsStatusOutput.includes("active"));

const statusOutput = await captureConsoleAsync(() =>
  byName.get("/status").execute({ engine: cellEngine })
);
assert.ok(statusOutput.includes("cell-001"));
assert.ok(statusOutput.includes("active"));
assert.ok(!statusOutput.includes("cell-002"));
assert.ok(!statusOutput.includes("idle"));
assert.ok(statusOutput.includes("Item"));
assert.ok(statusOutput.includes("Value"));
assert.ok(statusOutput.includes("Maturity State"));
assert.ok(statusOutput.includes("Temporal Variance"));

const whoamiOutput = await captureConsoleAsync(() =>
  byName.get("/whoami").execute({ engine: createEngine({ cradleMode: false }) })
);
assert.ok(whoamiOutput.includes("Cell ID   : cell-001"));

console.log("Engine status command tests passed");
