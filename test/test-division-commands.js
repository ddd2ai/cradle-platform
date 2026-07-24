import assert from "assert";
import { createDivisionCommands } from "../src/commands/division-commands.js";

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

function createEngine({ cradleMode = false, existingCells = ["cell-001"] } = {}) {
  const cells = new Map(existingCells.map((id) => [id, { id }]));

  return {
    cells,
    isCradleMode: () => cradleMode,
    hasCell: (cellId) => cells.has(cellId),
    getActiveCell: () => ({
      id: "cell-001",
      getMaturityInfo: async () => {
        throw new Error("unexpected maturity call");
      },
      getLifecycleDecision: async () => {
        throw new Error("unexpected lifecycle decision call");
      },
    }),
  };
}

const commands = createDivisionCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/divide"]
);

const divide = commands[0];
assert.equal(divide.match("/divide", { engine: createEngine() }), true);
assert.equal(divide.match("/divide child-001", { engine: createEngine() }), true);
assert.equal(
  divide.match("/divide", { engine: createEngine({ cradleMode: true }) }),
  false
);

const usageOutput = await captureConsoleAsync(() =>
  divide.execute({ engine: createEngine(), input: "/divide child-001 extra" })
);
assert.equal(usageOutput, "Usage: /divide [child-cell-id]");

const existingOutput = await captureConsoleAsync(() =>
  divide.execute({
    engine: createEngine({ existingCells: ["cell-001", "cell-002"] }),
    input: "/divide cell-002",
  })
);
assert.equal(existingOutput, "Cell already exists: cell-002");

console.log("Division command tests passed");
