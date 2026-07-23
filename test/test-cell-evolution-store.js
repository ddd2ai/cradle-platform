import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellEvolutionStore } from "../src/cell/cell-evolution-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-evolution-store-")
);
const thoughtsDir = path.join(tempRoot, "thoughts");
const evolutionsDir = path.join(tempRoot, "evolutions");
const evolutionStateFile = path.join(tempRoot, "evolution-state.json");

await fs.mkdir(thoughtsDir, { recursive: true });

const store = new CellEvolutionStore({
  thoughtsDir,
  evolutionsDir,
  evolutionStateFile,
  timestampFormatter: () => "20260723-101112",
  now: () => new Date("2026-07-23T10:11:12.000Z"),
  tail: (content, maxChars) => content.slice(-maxChars),
});

assert.deepEqual(await store.readEvolutionState(), {
  evolvedThoughts: [],
  evolutionCount: 0,
  lastEvolvedAt: null,
});
assert.deepEqual(await store.listThoughtFiles(), []);
assert.equal(await store.readRecentThoughts(), "");

await fs.writeFile(path.join(thoughtsDir, "003.md"), "third", "utf8");
await fs.writeFile(path.join(thoughtsDir, "001.md"), "first", "utf8");
await fs.writeFile(path.join(thoughtsDir, "002.txt"), "ignored", "utf8");
await fs.writeFile(path.join(thoughtsDir, "002.md"), "second", "utf8");

assert.deepEqual(await store.listThoughtFiles(), [
  "001.md",
  "002.md",
  "003.md",
]);
assert.match(await store.readRecentThoughts(200), /# 001.md/);
assert.match(await store.readRecentThoughts(200), /second/);

await store.writeEvolutionState({
  evolvedThoughts: ["001.md"],
  evolutionCount: 1,
  lastEvolvedAt: "2026-07-23T10:00:00.000Z",
});

assert.deepEqual(await store.readEvolutionState(), {
  evolvedThoughts: ["001.md"],
  evolutionCount: 1,
  lastEvolvedAt: "2026-07-23T10:00:00.000Z",
});
assert.deepEqual(await store.loadUnevolvedThoughts(1), [
  {
    file: "002.md",
    content: "second",
  },
]);

const journalFile = await store.writeEvolutionJournal({
  evolution: {
    summary: "learned payment domain",
    dnaDrift: [{ trait: "DECISION", factor: "strength", delta: 0.1 }],
    affinities: ["payments"],
  },
  thoughts: [{ file: "002.md" }],
});

assert.equal(journalFile, "evolution-20260723-101112.md");
const journal = await fs.readFile(
  path.join(evolutionsDir, journalFile),
  "utf8"
);
assert.match(journal, /learned payment domain/);
assert.match(journal, /DECISION/);
assert.match(journal, /002\.md/);

assert.throws(
  () => new CellEvolutionStore({ evolutionStateFile, evolutionsDir }),
  /requires thoughtsDir/
);
assert.throws(
  () => new CellEvolutionStore({ thoughtsDir, evolutionsDir }),
  /requires evolutionStateFile/
);
assert.throws(
  () => new CellEvolutionStore({ thoughtsDir, evolutionStateFile }),
  /requires evolutionsDir/
);
assert.throws(
  () => new CellEvolutionStore({ thoughtsDir, evolutionStateFile, evolutionsDir }),
  /requires timestampFormatter/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellEvolutionStore tests passed");
