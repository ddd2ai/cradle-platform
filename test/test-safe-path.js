import assert from "assert";
import os from "os";
import path from "path";
import { resolveInsideRoot } from "../src/utils/safe-path.js";

const root = path.join(os.tmpdir(), "cradle-safe-path");

assert.equal(resolveInsideRoot(root, "."), path.resolve(root));
assert.equal(
  resolveInsideRoot(root, "nested/file.md"),
  path.resolve(root, "nested/file.md")
);

assert.throws(
  () => resolveInsideRoot(root, "../outside.md"),
  /Path escapes root/
);

assert.throws(
  () =>
    resolveInsideRoot(root, "../outside.md", {
      errorMessage: (input) => `Custom escape: ${input}`,
    }),
  /Custom escape: \.\.\/outside\.md/
);

console.log("SafePath tests passed");
