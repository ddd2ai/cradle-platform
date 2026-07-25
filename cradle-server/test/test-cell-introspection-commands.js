import assert from "assert";
import { createCellIntrospectionCommands } from "../src/commands/cell-introspection-commands.js";

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
  const calls = [];
  const cell = {
    id: "cell-001",
    buildMemoryContext: async () => "memory context",
    buildCellSystemPrompt: async () => "system prompt",
    initDNA: async () => calls.push("initDNA"),
    readDNAContext: async () => "dna context",
    readDNAHistory: async () => [
      { at: "2026-07-24T10:00:00.000Z", reason: "init" },
    ],
    getMaturityInfo: async () => ({
      percent: 80,
      state: "stable",
      sampleSize: 4,
      magnitude: 2,
      normalizedMagnitude: 0.5,
      temporalVariance: 0.01,
      convergence: 0.9,
      currentTraitScores: {
        CREATION: 0.7,
      },
    }),
    getLifecycleDecision: async () => ({
      action: "continue",
      confidence: "high",
      reason: "stable",
      detail: {
        score: 0.7,
      },
    }),
    safeReadMemory: async (section) => `${section} text`,
    readRecentThoughts: async (limit) => `thoughts ${limit}`,
    think: async () => calls.push("think"),
  };

  return {
    calls,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const commands = createCellIntrospectionCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  [
    "/memory",
    "/prompt",
    "/dna init",
    "/dna",
    "/dna-history",
    "/maturity",
    "/lifecycle",
    "/memory full",
    "/thoughts",
    "/think",
  ]
);

const byName = new Map(commands.map((command) => [command.name, command]));

assert.equal(byName.get("/memory").match("/memory", { engine: createEngine() }), true);
assert.equal(
  byName.get("/memory").match("/memory", { engine: createEngine({ cradleMode: true }) }),
  false
);

assert.equal(
  await captureConsoleAsync(() =>
    byName.get("/memory").execute({ engine: createEngine() })
  ),
  "memory context"
);

assert.equal(
  await captureConsoleAsync(() =>
    byName.get("/prompt").execute({ engine: createEngine() })
  ),
  "system prompt"
);

const dnaOutput = await captureConsoleAsync(() =>
  byName.get("/dna-history").execute({ engine: createEngine() })
);
assert.ok(dnaOutput.includes("[1] 2026-07-24T10:00:00.000Z (init)"));

const maturityOutput = await captureConsoleAsync(() =>
  byName.get("/maturity").execute({ engine: createEngine() })
);
assert.ok(maturityOutput.includes("DNA Maturity"));
assert.ok(maturityOutput.includes("Maturity       : 80%"));

const lifecycleOutput = await captureConsoleAsync(() =>
  byName.get("/lifecycle").execute({ engine: createEngine() })
);
assert.ok(lifecycleOutput.includes("Cell Lifecycle Decision"));
assert.ok(lifecycleOutput.includes("Action           : continue"));

const fullMemoryOutput = await captureConsoleAsync(() =>
  byName.get("/memory full").execute({ engine: createEngine() })
);
assert.ok(fullMemoryOutput.includes("identity text"));
assert.ok(fullMemoryOutput.includes("history text"));

assert.equal(
  await captureConsoleAsync(() =>
    byName.get("/thoughts").execute({ engine: createEngine() })
  ),
  "thoughts 12000"
);

const dnaInitEngine = createEngine();
const dnaInitOutput = await captureConsoleAsync(() =>
  byName.get("/dna init").execute({ engine: dnaInitEngine })
);
assert.deepEqual(dnaInitEngine.calls, ["initDNA"]);
assert.ok(dnaInitOutput.includes("DNA initialized."));

const thinkEngine = createEngine();
const thinkOutput = await captureConsoleAsync(() =>
  byName.get("/think").execute({ engine: thinkEngine })
);
assert.deepEqual(thinkEngine.calls, ["think"]);
assert.ok(thinkOutput.includes("Thought created."));

console.log("Cell introspection command tests passed");
