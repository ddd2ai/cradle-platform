import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  CellConfigStore,
  DEFAULT_DNA_DEFINITIONS,
  DEFAULT_DNA_FACTORS,
} from "../src/cell/cell-config-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-config-store-")
);
const configDir = path.join(tempRoot, "config");
const dnaDir = path.join(tempRoot, "cell", "dna");

await fs.mkdir(configDir, { recursive: true });
await fs.mkdir(dnaDir, { recursive: true });

const store = new CellConfigStore({
  dnaDefinitionFile: path.join(configDir, "DNA_DEFINITION.md"),
  dnaFactorsFile: path.join(configDir, "DNA_FACTORS.md"),
  visionFile: path.join(configDir, "VISION.md"),
  environmentFile: path.join(configDir, "ENVIRONMENT.md"),
  dnaDir,
});

assert.deepEqual(await store.readDNADefinition(), DEFAULT_DNA_DEFINITIONS);
assert.deepEqual(await store.readDNAFactors(), DEFAULT_DNA_FACTORS);
assert.match(await store.readVision(), /建立一套電商系統/);
assert.match(await store.readEnvironment(), /Spring Boot/);

await fs.writeFile(
  store.dnaDefinitionFile,
  "# DNA\n\n## PERCEPTION\n\n## PAYMENT_GATEWAY\n",
  "utf8"
);
await fs.writeFile(
  store.dnaFactorsFile,
  "# Factors\n\n## strength\n\n## resilience\n",
  "utf8"
);

assert.deepEqual(await store.readDNADefinition(), [
  { name: "PERCEPTION", fileName: "perception.md" },
  { name: "PAYMENT_GATEWAY", fileName: "payment_gateway.md" },
]);
assert.deepEqual(await store.readDNAFactors(), [
  "strength",
  "resilience",
]);

const dnaFiles = await store.getDNAFiles();
assert.equal(dnaFiles.PERCEPTION, path.join(dnaDir, "perception.md"));
assert.equal(dnaFiles.PAYMENT_GATEWAY, path.join(dnaDir, "payment_gateway.md"));

await store.ensureRootFiles();
await store.prepareDNAFiles();

assert.match(await fs.readFile(store.visionFile, "utf8"), /VISION/);
assert.match(await fs.readFile(store.environmentFile, "utf8"), /ENVIRONMENT/);
assert.match(await fs.readFile(path.join(dnaDir, "perception.md"), "utf8"), /PERCEPTION DNA/);
assert.match(
  await fs.readFile(path.join(dnaDir, "payment_gateway.md"), "utf8"),
  /PAYMENT_GATEWAY DNA/
);
assert.match(store.createDNASeed("CREATION"), /CREATION DNA/);

assert.throws(
  () => new CellConfigStore({}),
  /requires dnaDefinitionFile/
);
assert.throws(
  () => new CellConfigStore({ dnaDefinitionFile: "x" }),
  /requires dnaFactorsFile/
);
assert.throws(
  () => new CellConfigStore({ dnaDefinitionFile: "x", dnaFactorsFile: "x" }),
  /requires visionFile/
);
assert.throws(
  () => new CellConfigStore({
    dnaDefinitionFile: "x",
    dnaFactorsFile: "x",
    visionFile: "x",
  }),
  /requires environmentFile/
);
assert.throws(
  () => new CellConfigStore({
    dnaDefinitionFile: "x",
    dnaFactorsFile: "x",
    visionFile: "x",
    environmentFile: "x",
  }),
  /requires dnaDir/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellConfigStore tests passed");
