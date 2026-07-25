import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { StimulusStore } from "../src/situation/stimulus-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-stimulus-store-")
);
const stimuliDir = path.join(tempRoot, "stimuli");

const store = new StimulusStore({
  stimuliDir,
  timestampFormatter: () => "20260723-101112",
});

const named = await store.writeStimulus({
  category: "threats",
  name: "build-failure.md",
  content: "compile failed",
});

assert.deepEqual(named, {
  category: "threats",
  file: "build-failure.md",
  path: path.join(stimuliDir, "threats", "build-failure.md"),
});
assert.equal(await fs.readFile(named.path, "utf8"), "compile failed");

const generated = await store.writeStimulus({
  content: "new signal",
});

assert.equal(generated.category, "signals");
assert.equal(generated.file, "stimulus-20260723-101112.md");
assert.equal(await fs.readFile(generated.path, "utf8"), "new signal");

await fs.writeFile(path.join(stimuliDir, "signals", "notes.txt"), "ignored");

const stimuli = await store.readStimuli();

assert.deepEqual(
  stimuli.map(({ category, file, content }) => ({ category, file, content })),
  [
    {
      category: "signals",
      file: "stimulus-20260723-101112.md",
      content: "new signal",
    },
    {
      category: "threats",
      file: "build-failure.md",
      content: "compile failed",
    },
  ]
);

await store.archiveStimuli(stimuli);

await assert.rejects(
  () => fs.access(path.join(stimuliDir, "signals", "stimulus-20260723-101112.md")),
  /ENOENT/
);
assert.equal(
  await fs.readFile(
    path.join(
      stimuliDir,
      "processed",
      "signals-20260723-101112-stimulus-20260723-101112.md"
    ),
    "utf8"
  ),
  "new signal"
);

await assert.rejects(
  () => store.writeStimulus({ category: "unknown" }),
  /Invalid stimulus category/
);

assert.throws(
  () => new StimulusStore({ timestampFormatter: () => "" }),
  /requires stimuliDir/
);
assert.throws(
  () => new StimulusStore({ stimuliDir }),
  /requires timestampFormatter/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("StimulusStore tests passed");
