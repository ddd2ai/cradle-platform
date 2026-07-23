import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellTaskStore } from "../src/cell/cell-task-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-task-store-")
);

const tasksDir = path.join(tempRoot, "tasks");
const tasksFile = path.join(tasksDir, "tasks.json");
let currentDate = new Date("2026-07-23T10:11:12.000Z");

const store = new CellTaskStore({
  tasksDir,
  tasksFile,
  timestampFormatter: () => "20260723-101112",
  idFactory: () => "abcdef12",
  now: () => currentDate,
});

assert.deepEqual(await store.readTasks(), []);

const task = await store.addTask({
  title: "Build task store",
  source: "test",
  content: "Persist tasks in JSON",
});

assert.deepEqual(task, {
  id: "task-20260723-101112-abcdef12",
  title: "Build task store",
  source: "test",
  content: "Persist tasks in JSON",
  status: "pending",
  createdAt: "2026-07-23T10:11:12.000Z",
  updatedAt: "2026-07-23T10:11:12.000Z",
});

assert.deepEqual(await store.readTasks(), [task]);
assert.deepEqual(await store.nextPendingTask(), task);

currentDate = new Date("2026-07-23T10:20:00.000Z");
await store.completeTask(task.id);

const completedTasks = await store.readTasks();

assert.equal(completedTasks.length, 1);
assert.equal(completedTasks[0].status, "done");
assert.equal(completedTasks[0].updatedAt, "2026-07-23T10:20:00.000Z");
assert.equal(await store.nextPendingTask(), null);

await store.writeTasks([
  { id: "done", status: "done" },
  { id: "pending", status: "pending" },
]);

assert.deepEqual(
  await store.nextPendingTask(),
  { id: "pending", status: "pending" }
);

assert.throws(
  () => new CellTaskStore({ tasksFile, timestampFormatter: () => "" }),
  /requires tasksDir/
);
assert.throws(
  () => new CellTaskStore({ tasksDir, timestampFormatter: () => "" }),
  /requires tasksFile/
);
assert.throws(
  () => new CellTaskStore({ tasksDir, tasksFile }),
  /requires timestampFormatter/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellTaskStore tests passed");
