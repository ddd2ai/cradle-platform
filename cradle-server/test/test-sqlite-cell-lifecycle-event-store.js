import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SqliteCellLifecycleEventStore } from "../src/persistence/sqlite-cell-lifecycle-event-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-sqlite-cell-events-"));
const file = path.join(root, "runtime.sqlite");
const legacyFile = path.join(root, "lifecycle-events.json");
await fs.writeFile(legacyFile, JSON.stringify([
  { at: "2026-09-04T10:00:00.000Z", type: "stimulus-cultivation", status: "stable" },
]));

const store = new SqliteCellLifecycleEventStore({ file, cellId: "cell-a", legacyFile });
assert.deepEqual(await store.readLifecycleEvents(), [
  { at: "2026-09-04T10:00:00.000Z", type: "stimulus-cultivation", status: "stable" },
]);

const appended = await Promise.all([
  store.appendLifecycleEvent({ type: "stimulus-cultivation", status: "cancelled" }),
  store.appendLifecycleEvent({ type: "heartbeat", status: "completed" }),
]);
assert.equal(appended.length, 2);
const events = await store.readLifecycleEvents();
assert.equal(events.length, 3);
assert.equal(events[0].status, "stable");
assert.deepEqual(events.slice(1).map((event) => event.status).sort(), ["cancelled", "completed"]);
store.close();

const reopened = new SqliteCellLifecycleEventStore({ file, cellId: "cell-a", legacyFile });
assert.equal((await reopened.readLifecycleEvents()).length, 3);
assert.equal((await reopened.readLifecycleEvents())[0].type, "stimulus-cultivation");
reopened.close();
await fs.rm(root, { recursive: true, force: true });
console.log("SQLite Cell lifecycle event store tests passed");
