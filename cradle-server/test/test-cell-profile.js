import assert from "assert";
import path from "path";
import { createCellPaths } from "../src/cell/cell-paths.js";
import {
  createDefaultCellProfile,
  createProfileDirectories,
  mergeCellProfileForStart,
} from "../src/cell/cell-profile.js";

const now = "2026-07-23T10:00:00.000Z";
const projectRoot = path.join("/tmp", "cradle-profile-project");
const paths = createCellPaths({
  cellId: "cell-001",
  projectRoot,
});

const directories = createProfileDirectories(paths);

assert.equal(directories.root, path.join("cells", "cell-001"));
assert.equal(directories.logs, path.join("cells", "cell-001", "logs"));
assert.equal(directories.workspaceDirs.notes, path.join("cells", "cell-001", "workspace", "notes"));
assert.equal(directories.inbox, path.join("cells", "cell-001", "inbox"));

const defaultProfile = createDefaultCellProfile({
  id: "cell-001",
  name: "Cell One",
  model: "gpt-5-mini",
  paths,
  now,
});

assert.equal(defaultProfile.id, "cell-001");
assert.equal(defaultProfile.name, "Cell One");
assert.equal(defaultProfile.model, "gpt-5-mini");
assert.equal(defaultProfile.status, "idle");
assert.equal(defaultProfile.maturity, 0);
assert.equal(defaultProfile.generation, 1);
assert.equal(defaultProfile.parent, null);
assert.deepEqual(defaultProfile.responsibilities, []);
assert.deepEqual(defaultProfile.relationships, []);
assert.equal(defaultProfile.createdAt, now);
assert.equal(defaultProfile.updatedAt, now);
assert.equal(defaultProfile.lastStartedAt, now);
assert.deepEqual(defaultProfile.directories, directories);

const existingProfile = {
  id: "cell-001",
  name: "",
  model: "old-model",
  status: "active",
  maturity: 42,
  generation: 3,
  parent: "cell-parent",
  responsibilities: ["payments"],
  relationships: [{ type: "depends-on", target: "cell-002" }],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  lastStartedAt: "2026-07-02T00:00:00.000Z",
  directories: { root: "old-root" },
};

const merged = mergeCellProfileForStart({
  existingProfile,
  id: "cell-001",
  name: "Cell One",
  model: "new-model",
  paths,
  now,
});

assert.equal(merged.name, "Cell One");
assert.equal(merged.model, "new-model");
assert.equal(merged.status, "idle");
assert.equal(merged.maturity, 42);
assert.equal(merged.generation, 3);
assert.equal(merged.parent, "cell-parent");
assert.deepEqual(merged.responsibilities, ["payments"]);
assert.deepEqual(merged.relationships, [{ type: "depends-on", target: "cell-002" }]);
assert.equal(merged.createdAt, "2026-07-01T00:00:00.000Z");
assert.equal(merged.updatedAt, now);
assert.equal(merged.lastStartedAt, now);
assert.deepEqual(merged.directories, directories);

const mergedWithDefaults = mergeCellProfileForStart({
  existingProfile: {
    id: "cell-001",
    name: "Existing Name",
  },
  id: "cell-001",
  name: "Cell One",
  model: "new-model",
  paths,
  now,
});

assert.equal(mergedWithDefaults.name, "Existing Name");
assert.equal(mergedWithDefaults.generation, 1);
assert.equal(mergedWithDefaults.parent, null);

assert.throws(
  () => createProfileDirectories(),
  /requires paths/
);

assert.throws(
  () => createDefaultCellProfile({ paths }),
  /requires id/
);

console.log("CellProfile tests passed");
