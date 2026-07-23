import assert from "assert";
import path from "path";
import { createCellPaths } from "../src/cell/cell-paths.js";

const projectRoot = path.join("/tmp", "cradle-project");
const paths = createCellPaths({
  cellId: "cell-001",
  projectRoot,
});

assert.equal(paths.rootDir, path.join("cells", "cell-001"));
assert.equal(paths.logsDir, path.join("cells", "cell-001", "logs"));
assert.equal(paths.memoryDir, path.join("cells", "cell-001", "memory"));
assert.equal(paths.dnaDir, path.join("cells", "cell-001", "dna"));
assert.equal(
  paths.dnaDefinitionFile,
  path.join(projectRoot, "config", "DNA_DEFINITION.md")
);
assert.equal(paths.situationDir, path.join(projectRoot, "situation"));
assert.equal(
  paths.workspaceDirs.productions,
  path.join("cells", "cell-001", "workspace", "productions")
);
assert.equal(
  paths.memoryFiles.history,
  path.join("cells", "cell-001", "memory", "history.md")
);

const customCellsDirPaths = createCellPaths({
  cellId: "cell-002",
  projectRoot,
  cellsDir: path.join(projectRoot, "runtime", "cells"),
});

assert.equal(
  customCellsDirPaths.rootDir,
  path.join(projectRoot, "runtime", "cells", "cell-002")
);
assert.equal(
  customCellsDirPaths.inboxFile,
  path.join(projectRoot, "runtime", "cells", "cell-002", "inbox", "messages.json")
);

assert.throws(
  () => createCellPaths(),
  /requires cellId/
);

console.log("CellPaths tests passed");
