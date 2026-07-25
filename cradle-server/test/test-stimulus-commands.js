import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createStimulusCommands } from "../src/commands/stimulus-commands.js";

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

async function createEngine({ cradleMode = false, stimuli = [] } = {}) {
  const observationsDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "cradle-observations-")
  );
  const cell = {
    observationsDir,
    readStimuli: async () => stimuli,
    buildMemoryContext: async () => "memory context",
    askWithTimeout: async () => ({ text: "```markdown\nobservation content\n```" }),
    metabolize: async () => ({
      created: 2,
      observationFile: "observation.md",
      reason: "new stimuli",
    }),
  };

  return {
    cell,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
    formatTimestamp: () => "20260724T100000",
    cleanMarkdownFence: (text) => text.replace(/^```markdown\n/, "").replace(/\n```$/, ""),
  };
}

const commands = createStimulusCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/observe", "/perceive", "/metabolize"]
);

const byName = new Map(commands.map((command) => [command.name, command]));

assert.equal(byName.get("/observe").match("/observe", { engine: await createEngine() }), true);
assert.equal(
  byName.get("/observe").match("/observe", { engine: await createEngine({ cradleMode: true }) }),
  false
);

const observeOutput = await captureConsoleAsync(async () =>
  byName.get("/observe").execute({
    engine: await createEngine({
      stimuli: [
        {
          category: "notes",
          file: "brief.md",
        },
      ],
    }),
  })
);
assert.ok(observeOutput.includes("Situation Stimuli"));
assert.ok(observeOutput.includes("[notes] brief.md"));

const emptyPerceiveOutput = await captureConsoleAsync(async () =>
  byName.get("/perceive").execute({ engine: await createEngine() })
);
assert.equal(emptyPerceiveOutput, "(no stimuli)");

const perceiveEngine = await createEngine({
  stimuli: [
    {
      category: "notes",
      file: "brief.md",
      content: "new signal",
    },
  ],
});
const perceiveOutput = await captureConsoleAsync(() =>
  byName.get("/perceive").execute({ engine: perceiveEngine })
);
const observation = await fs.readFile(
  path.join(perceiveEngine.cell.observationsDir, "observation-20260724T100000.md"),
  "utf8"
);
assert.equal(observation, "observation content");
assert.ok(perceiveOutput.includes("Observation created"));

const metabolizeOutput = await captureConsoleAsync(async () =>
  byName.get("/metabolize").execute({ engine: await createEngine() })
);
assert.ok(metabolizeOutput.includes("Metabolism completed."));
assert.ok(metabolizeOutput.includes("Created tasks : 2"));

console.log("Stimulus command tests passed");
