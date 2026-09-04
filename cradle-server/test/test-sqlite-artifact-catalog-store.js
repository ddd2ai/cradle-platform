import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SqliteArtifactCatalogStore } from "../src/persistence/sqlite-artifact-catalog-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-artifact-catalog-"));
const store = new SqliteArtifactCatalogStore({ file: path.join(root, "cradle.sqlite") });
store.upsertManifest({ storageDir: "/cells/cell-1/workspace/productions/a-1", manifest: {
  id: "a-1", ownerCellId: "cell-1", type: "code", title: "Demo", goal: "test", status: "validated",
  revision: { revisionId: "rev-1" }, outputs: [{ kind: "file", path: "src/index.js" }],
} });
assert.deepEqual(store.listByCell("cell-1")[0].outputPaths, ["src/index.js"]);
store.close();
console.log("SQLite Artifact catalog store tests passed");
