import assert from "assert";
import { createEngineCellCommands } from "../src/commands/engine-cell-commands.js";

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
  const created = [];
  const activated = [];
  const deactivated = [];
  const cells = new Map([
    ["cell-001", { id: "cell-001" }],
  ]);

  return {
    CRADLE_ID: "Cradle",
    activeCellId: "cell-001",
    cells,
    created,
    activated,
    deactivated,
    createCell: async (id) => {
      created.push(id);
      cells.set(id, { id });
    },
    activateCell: async (id) => activated.push(id),
    deactivateCell: async (id) => deactivated.push(id),
    activateAllCells: async () => activated.push("*"),
    deactivateAllCells: async () => deactivated.push("*"),
  };
}

const commands = createEngineCellCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  [
    "/cradle",
    "/cells",
    "/new",
    "/use",
    "/activate",
    "/deactivate",
    "/activate-all",
    "/deactivate-all",
  ]
);

const byName = new Map(commands.map((command) => [command.name, command]));

const engine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/cradle").execute({ engine })
);
assert.equal(engine.activeCellId, "Cradle");

const cellsOutput = await captureConsoleAsync(() =>
  byName.get("/cells").execute({ engine })
);
assert.equal(cellsOutput, "cell-001");

const newOutput = await captureConsoleAsync(() =>
  byName.get("/new").execute({ engine, input: "/new cell-002" })
);
assert.deepEqual(engine.created, ["cell-002"]);
assert.equal(engine.activeCellId, "cell-002");
assert.ok(newOutput.includes("Created and switched to cell-002"));

const reservedOutput = await captureConsoleAsync(() =>
  byName.get("/new").execute({ engine, input: "/new Cradle" })
);
assert.equal(reservedOutput, "Cradle is reserved for Engine mode.");

await captureConsoleAsync(() =>
  byName.get("/use").execute({ engine, input: "/use cell-001" })
);
assert.equal(engine.activeCellId, "cell-001");

const missingUseOutput = await captureConsoleAsync(() =>
  byName.get("/use").execute({ engine, input: "/use cell-404" })
);
assert.equal(missingUseOutput, "Cell not found: cell-404");

await byName.get("/activate").execute({ engine, input: "/activate cell-001" });
await byName.get("/deactivate").execute({ engine, input: "/deactivate cell-001" });
await byName.get("/activate-all").execute({ engine });
await byName.get("/deactivate-all").execute({ engine });
assert.deepEqual(engine.activated, ["cell-001", "*"]);
assert.deepEqual(engine.deactivated, ["cell-001", "*"]);

console.log("Engine cell command tests passed");
