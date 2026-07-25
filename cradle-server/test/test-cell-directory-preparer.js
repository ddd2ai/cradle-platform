import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createCellPaths } from "../src/cell/cell-paths.js";
import {
  listCellDirectories,
  prepareCellDirectories,
} from "../src/cell/cell-directory-preparer.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-cell-dirs-")
);

const paths = createCellPaths({
  cellId: "cell-001",
  projectRoot: tempRoot,
  cellsDir: path.join(tempRoot, "cells"),
});

const directories = listCellDirectories(paths);

assert(directories.includes(paths.logsDir));
assert(directories.includes(paths.memoryDir));
assert(directories.includes(paths.workspaceDirs.notes));
assert(directories.includes(path.join(paths.stimuliDir, "signals")));
assert(directories.includes(path.join(paths.stimuliDir, "processed")));
assert(directories.includes(paths.metricsDir));

await prepareCellDirectories(paths);

for (const dir of directories) {
  const stat = await fs.stat(dir);
  assert(stat.isDirectory(), `${dir} should be a directory`);
}

assert.throws(
  () => listCellDirectories(),
  /requires paths/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellDirectoryPreparer tests passed");
