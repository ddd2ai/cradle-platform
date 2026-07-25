import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { LivingContextStore } from "../src/living-context/living-context-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-living-context-store-")
);
const livingContextFile = path.join(tempRoot, "living-context.json");
const now = () => new Date("2026-07-23T10:11:12.000Z");

const store = new LivingContextStore({
  livingContextFile,
  now,
});

assert.equal(await store.readLivingContext(), null);

await store.writeLivingContext({
  cellId: "cell-001",
  purpose: "test",
  responsibilities: ["testing"],
});

assert.deepEqual(await store.readLivingContext(), {
  cellId: "cell-001",
  purpose: "test",
  responsibilities: ["testing"],
  updatedAt: "2026-07-23T10:11:12.000Z",
});

assert.throws(
  () => new LivingContextStore(),
  /requires livingContextFile/
);

await assert.rejects(
  () => store.writeLivingContext(null),
  /context must be an object/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("LivingContextStore tests passed");
