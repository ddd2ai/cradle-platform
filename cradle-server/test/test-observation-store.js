import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ObservationStore } from "../src/situation/observation-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-observation-store-")
);
const observationsDir = path.join(tempRoot, "observations");
const store = new ObservationStore({
  observationsDir,
  timestampFormatter: () => "20260723-101112",
  now: () => new Date("2026-07-23T10:11:12.000Z"),
});

const file = await store.writeObservationMarkdown("Summary\n\n- fact");

assert.equal(file, "observation-20260723-101112.md");

const content = await fs.readFile(path.join(observationsDir, file), "utf8");
assert.match(content, /^# Observation/);
assert.match(content, /Summary/);
assert.match(content, /createdAt: 2026-07-23T10:11:12\.000Z/);

assert.throws(
  () => new ObservationStore({ timestampFormatter: () => "" }),
  /requires observationsDir/
);
assert.throws(
  () => new ObservationStore({ observationsDir }),
  /requires timestampFormatter/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("ObservationStore tests passed");
