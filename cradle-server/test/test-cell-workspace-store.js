import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellWorkspaceStore } from "../src/cell/cell-workspace-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-workspace-store-")
);
const workspaceDir = path.join(tempRoot, "workspace");
const store = new CellWorkspaceStore({ workspaceDir });

assert.deepEqual(await store.listWorkspace(), []);

await store.writeWorkspaceFile("notes/one.md", "one");
await store.writeWorkspaceFile("projects/app/index.js", "console.log('hi');");
await store.appendWorkspaceFile("notes/one.md", "two");

assert.equal(await store.readWorkspaceFile("notes/one.md"), "one\ntwo\n");
assert.deepEqual(await store.listWorkspace(), [
  "notes/",
  "notes/one.md",
  "projects/",
  "projects/app/",
  "projects/app/index.js",
]);

const sections = await store.listWorkspaceSections();
assert.deepEqual(sections.notes, ["one.md"]);
assert.deepEqual(sections.projects, ["app/", "app/index.js"]);
assert.deepEqual(sections.tasks, []);

assert.throws(
  () => store.resolveInside(workspaceDir, "../outside.md"),
  /Invalid path outside cell directory/
);
assert.throws(
  () => new CellWorkspaceStore(),
  /requires workspaceDir/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellWorkspaceStore tests passed");
