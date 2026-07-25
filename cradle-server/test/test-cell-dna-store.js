import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellDNAStore } from "../src/cell/cell-dna-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-dna-store-")
);
const dnaVectorFile = path.join(tempRoot, "dna-vector.json");
const dnaHistoryFile = path.join(tempRoot, "dna-history.json");
let currentDate = new Date("2026-07-23T10:00:00.000Z");

const store = new CellDNAStore({
  dnaVectorFile,
  dnaHistoryFile,
  now: () => currentDate,
});

assert.equal(await store.readDNAVector(), null);
assert.deepEqual(await store.readDNAHistory(), []);
assert.equal(await store.appendDNAHistoryIfChanged("missing"), false);

const vector = {
  PERCEPTION: {
    strength: 0.5,
    stability: 0.7,
  },
};

await store.writeDNAVector(vector);
assert.deepEqual(await store.readDNAVector(), vector);

await store.appendDNAHistory("prepare");
assert.deepEqual(await store.readDNAHistory(), [
  {
    at: "2026-07-23T10:00:00.000Z",
    reason: "prepare",
    vector,
  },
]);

assert.equal(await store.appendDNAHistoryIfChanged("same"), false);

currentDate = new Date("2026-07-23T10:05:00.000Z");
const nextVector = {
  PERCEPTION: {
    strength: 0.6,
    stability: 0.7,
  },
};

await store.writeDNAVector(nextVector);
assert.equal(await store.appendDNAHistoryIfChanged("evolution"), true);
assert.deepEqual(await store.readDNAHistory(), [
  {
    at: "2026-07-23T10:00:00.000Z",
    reason: "prepare",
    vector,
  },
  {
    at: "2026-07-23T10:05:00.000Z",
    reason: "evolution",
    vector: nextVector,
  },
]);

await store.writeDNAHistory([]);
assert.deepEqual(await store.readDNAHistory(), []);

const dnaFiles = {
  PERCEPTION: path.join(tempRoot, "perception.md"),
  DECISION: path.join(tempRoot, "decision.md"),
};

await store.writeDNAFiles(dnaFiles, {
  perception: "# Perception",
  UNKNOWN: "# Unknown",
});

assert.equal(await fs.readFile(dnaFiles.PERCEPTION, "utf8"), "# Perception");
await assert.rejects(
  () => fs.readFile(dnaFiles.DECISION, "utf8"),
  /ENOENT/
);

assert.throws(
  () => new CellDNAStore({ dnaHistoryFile }),
  /requires dnaVectorFile/
);
assert.throws(
  () => new CellDNAStore({ dnaVectorFile }),
  /requires dnaHistoryFile/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellDNAStore tests passed");
