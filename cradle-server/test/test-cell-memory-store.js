import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellMemoryStore } from "../src/cell/cell-memory-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-memory-store-")
);
const memoryDir = path.join(tempRoot, "memory");
const thoughtsDir = path.join(tempRoot, "thoughts");

await fs.mkdir(memoryDir, { recursive: true });
await fs.mkdir(thoughtsDir, { recursive: true });

const memoryFiles = {
  identity: path.join(memoryDir, "identity.md"),
  rules: path.join(memoryDir, "rules.md"),
  knowledge: path.join(memoryDir, "knowledge.md"),
  history: path.join(memoryDir, "history.md"),
};

const store = new CellMemoryStore({
  memoryFiles,
  thoughtsDir,
  cellId: "cell-001",
  cellName: "Cell One",
  timestampFormatter: () => "20260723-101112",
});

await store.prepareMemoryFiles();

assert.match(await store.readMemory("identity"), /I am Cell One/);
assert.match(await store.readMemory("identity"), /My cell id is cell-001/);
assert.match(await store.readMemory("rules"), /Use Traditional Chinese/);
assert.match(await store.readMemory("knowledge"), /# Knowledge/);
assert.match(await store.readMemory("history"), /# History/);

await store.writeMemory("knowledge", "# Knowledge\n\nInitial");
assert.equal(await store.readMemory("knowledge"), "# Knowledge\n\nInitial");

await store.appendKnowledge("Learned item");
assert.match(await store.readMemory("knowledge"), /Learned item/);

await store.appendHistory("History item");
assert.match(await store.readMemory("history"), /History item/);

await store.appendThought("# Thought");
assert.equal(
  await fs.readFile(path.join(thoughtsDir, "20260723-101112.md"), "utf8"),
  "# Thought"
);

assert.equal(await store.safeReadMemory("missing"), "");
assert.throws(
  () => store.resolveMemoryFile("missing"),
  /Unknown memory file/
);

assert.throws(
  () => new CellMemoryStore({ thoughtsDir, timestampFormatter: () => "" }),
  /requires memoryFiles/
);
assert.throws(
  () => new CellMemoryStore({ memoryFiles, timestampFormatter: () => "" }),
  /requires thoughtsDir/
);
assert.throws(
  () => new CellMemoryStore({ memoryFiles, thoughtsDir }),
  /requires timestampFormatter/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellMemoryStore tests passed");
