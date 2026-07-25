import assert from "assert";
import { createCellResponsibilityCommands } from "../src/commands/cell-responsibility-commands.js";

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
  const cell = {
    addResponsibility: async (name) => responsibilities.push(name),
    listResponsibilities: async () => responsibilities,
  };

  return {
    responsibilities,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const commands = createCellResponsibilityCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/resp"]
);

const respCommand = commands[0];
assert.equal(respCommand.match("/resp list", { engine: createEngine() }), true);
assert.equal(
  respCommand.match("/resp list", { engine: createEngine({ cradleMode: true }) }),
  false
);

const addEngine = createEngine();
const addOutput = await captureConsoleAsync(() =>
  respCommand.execute({ engine: addEngine, input: "/resp add writing" })
);
assert.ok(addEngine.responsibilities.includes("writing"));
assert.equal(addOutput, "Responsibility added: writing");

const listOutput = await captureConsoleAsync(() =>
  respCommand.execute({ engine: addEngine, input: "/resp list" })
);
assert.ok(listOutput.includes("research"));
assert.ok(listOutput.includes("writing"));

const usageOutput = await captureConsoleAsync(() =>
  respCommand.execute({ engine: createEngine(), input: "/resp remove writing" })
);
assert.equal(usageOutput, "Usage: /resp add <name> | /resp list");

console.log("Cell responsibility command tests passed");
