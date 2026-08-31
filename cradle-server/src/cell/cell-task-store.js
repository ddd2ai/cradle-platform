import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class CellTaskStore {
  constructor({
    tasksDir,
    tasksFile,
    timestampFormatter,
    idFactory = () => crypto.randomUUID().slice(0, 8),
    now = () => new Date(),
  } = {}) {
    if (!tasksDir) {
      throw new Error("CellTaskStore requires tasksDir");
    }

    if (!tasksFile) {
      throw new Error("CellTaskStore requires tasksFile");
    }

    if (!timestampFormatter) {
      throw new Error("CellTaskStore requires timestampFormatter");
    }

    this.tasksDir = tasksDir;
    this.tasksFile = tasksFile;
    this.timestampFormatter = timestampFormatter;
    this.idFactory = idFactory;
    this.now = now;
    this.recordsDir = path.join(tasksDir, "records");
    this.pendingDir = path.join(this.recordsDir, "pending");
    this.doneDir = path.join(this.recordsDir, "done");
    this.migrationMarker = path.join(this.recordsDir, ".task-store-v2.json");
    this.migrationPromise = null;
  }

  async readTasks() {
    await this.#ensureMigrated();
    const [pending, done] = await Promise.all([
      this.#readTaskDirectory(this.pendingDir),
      this.#readTaskDirectory(this.doneDir),
    ]);
    return [...pending, ...done].sort(compareTasks);
  }

  async writeTasks(tasks = []) {
    await fs.rm(this.recordsDir, { recursive: true, force: true });
    await fs.mkdir(this.recordsDir, { recursive: true });
    for (const task of tasks) {
      await this.#writeTaskRecord(task);
    }
    await writeJsonFile(this.tasksFile, [], { dir: this.tasksDir });
    await writeJsonFile(this.migrationMarker, { version: 2 });
    this.migrationPromise = Promise.resolve();
  }

  async addTask({
    title,
    source = "manual",
    content = "",
  } = {}) {
    await this.#ensureMigrated();
    const createdAt = this.now().toISOString();

    const task = {
      id: `task-${this.timestampFormatter(new Date(createdAt))}-${this.idFactory()}`,
      title,
      source,
      content,
      status: "pending",
      createdAt,
      updatedAt: createdAt,
    };

    await this.#writeTaskRecord(task);

    return task;
  }

  async completeTask(taskId) {
    await this.#ensureMigrated();
    const updatedAt = this.now().toISOString();
    const pendingPath = this.#taskPath(this.pendingDir, taskId);
    const task = await readJsonFile(pendingPath, null);
    if (!task) return;

    task.status = "done";
    task.updatedAt = updatedAt;
    await this.#writeTaskRecord(task);
    await fs.rm(pendingPath, { force: true });
  }

  async nextPendingTask() {
    await this.#ensureMigrated();
    const tasks = await this.#readTaskDirectory(this.pendingDir, { firstOnly: true });
    return tasks[0] ?? null;
  }

  async #ensureMigrated() {
    if (!this.migrationPromise) {
      this.migrationPromise = this.#migrateLegacyTasks();
    }
    await this.migrationPromise;
  }

  async #migrateLegacyTasks() {
    try {
      await fs.access(this.migrationMarker);
      return;
    } catch {
      // Continue with the one-time migration.
    }

    const legacyTasks = await readJsonFile(this.tasksFile, []);
    await fs.mkdir(this.recordsDir, { recursive: true });
    for (const task of legacyTasks) {
      await this.#writeTaskRecord(task);
    }
    await writeJsonFile(this.tasksFile, [], { dir: this.tasksDir });
    await writeJsonFile(this.migrationMarker, { version: 2 });
  }

  async #writeTaskRecord(task) {
    const dir = task.status === "done" ? this.doneDir : this.pendingDir;
    await writeJsonFile(this.#taskPath(dir, task.id), task, { dir });
  }

  #taskPath(dir, taskId) {
    const safeId = String(taskId).replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(dir, `${safeId}.json`);
  }

  async #readTaskDirectory(dir, { firstOnly = false } = {}) {
    let files = [];
    try {
      files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json")).sort();
    } catch {
      return [];
    }

    if (firstOnly) files = files.slice(0, 1);
    const tasks = [];
    for (const file of files) {
      const task = await readJsonFile(path.join(dir, file), null);
      if (task) tasks.push(task);
    }
    return tasks;
  }
}

function compareTasks(a, b) {
  return String(a?.createdAt ?? a?.id ?? "").localeCompare(
    String(b?.createdAt ?? b?.id ?? "")
  );
}
