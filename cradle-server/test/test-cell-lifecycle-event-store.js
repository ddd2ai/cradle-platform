import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellLifecycleEventStore } from "../src/cell/cell-lifecycle-event-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-lifecycle-events-")
);
const lifecycleEventsFile = path.join(tempRoot, "lifecycle-events.json");

let currentDate = new Date("2026-07-23T10:00:00.000Z");
const store = new CellLifecycleEventStore({
  lifecycleEventsFile,
  now: () => currentDate,
});

assert.deepEqual(await store.readLifecycleEvents(), []);

await store.appendLifecycleEvent({
  type: "decision",
  action: "stay",
});

assert.deepEqual(await store.readLifecycleEvents(), [
  {
    at: "2026-07-23T10:00:00.000Z",
    type: "decision",
    action: "stay",
  },
]);

currentDate = new Date("2026-07-23T10:05:00.000Z");
await store.appendLifecycleEvent({
  type: "repair",
  action: "queued",
});

assert.deepEqual(await store.readLifecycleEvents(), [
  {
    at: "2026-07-23T10:00:00.000Z",
    type: "decision",
    action: "stay",
  },
  {
    at: "2026-07-23T10:05:00.000Z",
    type: "repair",
    action: "queued",
  },
]);

assert.throws(
  () => new CellLifecycleEventStore(),
  /requires lifecycleEventsFile/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellLifecycleEventStore tests passed");
