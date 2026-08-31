import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getActivationConcurrency,
  readCradleConfig,
} from "../src/cradle-config.js";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-runtime-config-"));
const configFile = path.join(tempDir, "cradle-config.json");

assert.equal(getActivationConcurrency({ file: configFile }), 4);

await fs.writeFile(configFile, JSON.stringify({
  runtime: { activationConcurrency: 7 },
}));
assert.equal(getActivationConcurrency({ file: configFile }), 7);
assert.equal(readCradleConfig({ file: configFile }).ai.defaultProvider, "ollama");

await fs.writeFile(configFile, JSON.stringify({
  runtime: { activationConcurrency: 0 },
}));
assert.throws(
  () => getActivationConcurrency({ file: configFile }),
  /runtime\.activationConcurrency/
);

await fs.rm(tempDir, { recursive: true, force: true });
console.log("Cradle runtime config tests passed");
