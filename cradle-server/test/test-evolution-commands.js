import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createEvolutionCommands } from "../src/commands/evolution-commands.js";

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

async function createEngine({
  cradleMode = false,
  evolveResult = {
    evolved: true,
    file: "evolution.md",
    thoughtCount: 2,
    dnaDrift: ["CREATION"],
  },
  latestEvolution = "latest evolution",
  evolutionFiles = ["b.txt", "z.md", "a.md"],
} = {}) {
  const evolutionsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cradle-evolutions-")
  );

  for (const file of evolutionFiles) {
    await fs.writeFile(path.join(evolutionsDir, file), "");
  }

  const evolveCalls = [];
  const cell = {
    evolutionsDir,
    evolve: async (options) => {
      evolveCalls.push(options);
      return evolveResult;
    },
    readLatestEvolution: async () => latestEvolution,
  };

  return {
    evolveCalls,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const commands = createEvolutionCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/evolve", "/evolution", "/evolutions"]
);

const evolve = commands.find((command) => command.name === "/evolve");
const evolution = commands.find((command) => command.name === "/evolution");
const evolutions = commands.find((command) => command.name === "/evolutions");

assert.equal(evolve.match("/evolve", { engine: await createEngine() }), true);
assert.equal(
  evolve.match("/evolve", { engine: await createEngine({ cradleMode: true }) }),
  false
);
assert.equal(evolution.match("/evolution", { engine: await createEngine() }), true);
assert.equal(evolutions.match("/evolutions", { engine: await createEngine() }), true);

const evolveEngine = await createEngine();
const evolveOutput = await captureConsoleAsync(() =>
  evolve.execute({ engine: evolveEngine })
);
assert.deepEqual(evolveEngine.evolveCalls, [{ force: true }]);
assert.ok(evolveOutput.includes("Evolving from thoughts"));
assert.ok(evolveOutput.includes("Evolution completed."));

const skippedEngine = await createEngine({
  evolveResult: {
    evolved: false,
    reason: "not enough thoughts",
    thoughtCount: 1,
  },
});
const skippedOutput = await captureConsoleAsync(() =>
  evolve.execute({ engine: skippedEngine })
);
assert.ok(skippedOutput.includes("Evolution skipped."));
assert.ok(skippedOutput.includes("not enough thoughts"));

const latestOutput = await captureConsoleAsync(async () =>
  evolution.execute({ engine: await createEngine({ latestEvolution: null }) })
);
assert.equal(latestOutput, "No evolution found.");

const listOutput = await captureConsoleAsync(async () =>
  evolutions.execute({ engine: await createEngine() })
);
assert.ok(listOutput.indexOf("a.md") < listOutput.indexOf("z.md"));
assert.ok(!listOutput.includes("b.txt"));

console.log("Evolution command tests passed");
