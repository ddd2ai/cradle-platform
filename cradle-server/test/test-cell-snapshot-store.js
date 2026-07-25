import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellSnapshotStore } from "../src/cell/cell-snapshot-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-snapshot-store-")
);

const snapshotsDir = path.join(tempRoot, "snapshots");
const memoryDir = path.join(tempRoot, "memory");
const workspaceDir = path.join(tempRoot, "workspace");
const thoughtsDir = path.join(tempRoot, "thoughts");
const cellFile = path.join(tempRoot, "cell.json");

await fs.mkdir(path.join(memoryDir, "nested"), { recursive: true });
await fs.mkdir(workspaceDir, { recursive: true });
await fs.mkdir(thoughtsDir, { recursive: true });
await fs.writeFile(path.join(memoryDir, "nested", "history.md"), "history", "utf8");
await fs.writeFile(path.join(workspaceDir, "artifact.md"), "artifact", "utf8");
await fs.writeFile(path.join(thoughtsDir, "thought.md"), "thought", "utf8");
await fs.writeFile(cellFile, JSON.stringify({ id: "cell-001" }), "utf8");

const store = new CellSnapshotStore({
  cellId: "cell-001",
  snapshotsDir,
  memoryDir,
  workspaceDir,
  thoughtsDir,
  cellFile,
  timestampFormatter: () => "20260723-101112",
  now: () => new Date("2026-07-23T10:11:12.000Z"),
});

assert.deepEqual(await store.listSnapshots(), []);

const snapshotName = await store.createSnapshot();
assert.equal(snapshotName, "snapshot-20260723-101112");
assert.deepEqual(await store.listSnapshots(), [snapshotName]);

const manifest = JSON.parse(
  await fs.readFile(path.join(snapshotsDir, snapshotName, "snapshot.json"), "utf8")
);
assert.equal(manifest.cellId, "cell-001");
assert.equal(manifest.createdAt, "2026-07-23T10:11:12.000Z");
assert.equal(
  await fs.readFile(path.join(snapshotsDir, snapshotName, "memory", "nested", "history.md"), "utf8"),
  "history"
);

await fs.writeFile(path.join(memoryDir, "nested", "history.md"), "changed", "utf8");
await fs.writeFile(path.join(workspaceDir, "artifact.md"), "changed", "utf8");
await store.restoreSnapshot(snapshotName);

assert.equal(await fs.readFile(path.join(memoryDir, "nested", "history.md"), "utf8"), "history");
assert.equal(await fs.readFile(path.join(workspaceDir, "artifact.md"), "utf8"), "artifact");
assert.deepEqual(JSON.parse(await fs.readFile(cellFile, "utf8")), { id: "cell-001" });

await store.copyDirectory(path.join(tempRoot, "missing"), path.join(tempRoot, "empty"));
assert((await fs.stat(path.join(tempRoot, "empty"))).isDirectory());

await assert.rejects(
  () => store.restoreSnapshot(),
  /Snapshot name is required/
);

assert.throws(
  () => new CellSnapshotStore({}),
  /requires cellId/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellSnapshotStore tests passed");
