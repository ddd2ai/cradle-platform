import assert from "assert";
import { createCellProfileCommands } from "../src/commands/cell-profile-commands.js";

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
  const knowledge = [];
  const cell = {
    id: "cell-001",
    addResponsibility: async (name) => responsibilities.push(name),
    getProfile: async () => ({ id: "cell-001" }),
    calculateConvergence: async () => 0.75,
    appendKnowledge: async (content) => knowledge.push(content),
  };

  return {
    responsibilities,
    knowledge,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const commands = createCellProfileCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/profile", "/specialize"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/profile").match("/profile", { engine: createEngine() }), true);
assert.equal(
  byName.get("/profile").match("/profile", { engine: createEngine({ cradleMode: true }) }),
  false
);

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

const usageOutput = await captureConsoleAsync(() =>
  byName.get("/specialize").execute({
    engine: createEngine(),
    input: "/specialize ",
  })
);
assert.equal(usageOutput, "Usage: /specialize <responsibility>");

console.log("Cell profile command tests passed");
