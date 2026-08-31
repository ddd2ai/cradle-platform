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
  type: "build.failed",
  source: "test",
  targetCellIds: ["cell-b"],
  dedupKey: "build-001",
  content: "compile failed",
});

assert.equal(named.category, "threats");
assert.equal(named.envelope.type, "build.failed");
assert.equal(named.routes[0].targetCellId, "cell-b");
assert.equal(JSON.parse(await fs.readFile(named.path, "utf8")).content, "compile failed");

const generated = await store.writeStimulus({
  targetCellIds: ["cell-a"],
  dedupKey: "signal-001",
  content: "new signal",
});

assert.equal(generated.category, "signals");
assert.equal(generated.file.endsWith(".json"), true);
assert.equal(JSON.parse(await fs.readFile(generated.path, "utf8")).content, "new signal");

const duplicate = await store.writeStimulus({
  targetCellIds: ["cell-a"],
  dedupKey: "signal-001",
  content: "duplicate signal",
});
assert.equal(duplicate.duplicate, true);

await fs.mkdir(path.join(stimuliDir, "signals"), { recursive: true });
await fs.writeFile(path.join(stimuliDir, "signals", "notes.txt"), "ignored");
await fs.writeFile(
  path.join(stimuliDir, "signals", "legacy.md"),
  "## Cell\n\ncell-a\n\nlegacy signal"
);

const stimuli = await store.readStimuli({ consumerId: "cell-a" });

assert.equal(stimuli.length, 2);
assert.equal(stimuli.some((item) => item.content === "new signal"), true);
assert.equal(stimuli.some((item) => item.file === "legacy.md"), true);
assert.equal((await store.readStimuli({ consumerId: "cell-b" })).length, 1);

await store.archiveStimuli(stimuli);
await store.archiveStimuli(await store.claimStimuli({ consumerId: "cell-b" }));

assert.equal((await store.readStimuli({ consumerId: "cell-a" })).length, 0);

await store.writeStimulus({
  category: "signals",
  targetCellIds: ["cell-b"],
  dedupKey: "targeted-001",
  content: "targeted",
});
assert.deepEqual(await store.claimStimuli({ consumerId: "cell-a" }), []);
const targetedClaim = await store.claimStimuli({ consumerId: "cell-b" });
assert.equal(targetedClaim.length, 1);
assert.equal(targetedClaim[0].targetCellId, "cell-b");
assert.equal(targetedClaim[0].envelope.schemaVersion, 1);
assert.deepEqual(await store.claimStimuli({ consumerId: "cell-b" }), []);
await store.releaseStimuli(targetedClaim);
assert.equal((await store.claimStimuli({ consumerId: "cell-b" })).length, 1);

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
