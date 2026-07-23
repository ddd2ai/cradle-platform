import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellProfileStore } from "../src/cell/cell-profile-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-profile-store-")
);
const cellFile = path.join(tempRoot, "cell.json");
const profileFile = path.join(tempRoot, "profile.json");
let currentDate = new Date("2026-07-23T10:00:00.000Z");

const store = new CellProfileStore({
  cellFile,
  profileFile,
  now: () => currentDate,
});

assert.equal(await store.readCellProfile(), null);
assert.equal(await store.readProfile(), null);
assert.deepEqual(await store.getProfile(), {});
assert.equal(await store.getStatus(), "unknown");

await store.writeCellProfile({
  id: "cell-001",
  status: "idle",
  maturity: 2,
});

assert.deepEqual(await store.readCellProfile(), {
  id: "cell-001",
  status: "idle",
  maturity: 2,
});
assert.equal(await store.getStatus(), "idle");

await fs.writeFile(
  profileFile,
  JSON.stringify({ id: "legacy-profile", purpose: "test" }, null, 2),
  "utf8"
);
assert.deepEqual(await store.readProfile(), {
  id: "legacy-profile",
  purpose: "test",
});

currentDate = new Date("2026-07-23T10:05:00.000Z");
await store.updateStatus("running");
assert.deepEqual(await store.readCellProfile(), {
  id: "cell-001",
  status: "running",
  maturity: 2,
  updatedAt: "2026-07-23T10:05:00.000Z",
});

currentDate = new Date("2026-07-23T10:10:00.000Z");
await store.increaseMaturity(3);
assert.deepEqual(await store.readCellProfile(), {
  id: "cell-001",
  status: "running",
  maturity: 5,
  updatedAt: "2026-07-23T10:10:00.000Z",
});

const missingStore = new CellProfileStore({
  cellFile: path.join(tempRoot, "missing-cell.json"),
  profileFile: path.join(tempRoot, "missing-profile.json"),
  now: () => currentDate,
});

await missingStore.updateStatus("active");
await missingStore.increaseMaturity(1);
assert.equal(await missingStore.readCellProfile(), null);

assert.throws(
  () => new CellProfileStore({ profileFile }),
  /requires cellFile/
);
assert.throws(
  () => new CellProfileStore({ cellFile }),
  /requires profileFile/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellProfileStore tests passed");
