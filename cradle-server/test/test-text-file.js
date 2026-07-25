import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { writeTextFile } from "../src/utils/text-file.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-text-file-")
);
const file = path.join(tempRoot, "nested", "note.md");

await writeTextFile(file, "hello");

assert.equal(await fs.readFile(file, "utf8"), "hello");

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("TextFile tests passed");
