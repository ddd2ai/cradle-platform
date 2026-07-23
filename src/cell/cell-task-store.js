import crypto from "crypto";
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
  }

  async readTasks() {
    return readJsonFile(this.tasksFile, []);
  }

  async writeTasks(tasks = []) {
    await writeJsonFile(this.tasksFile, tasks, { dir: this.tasksDir });
  }

  async addTask({
    title,
    source = "manual",
    content = "",
  } = {}) {
    const tasks = await this.readTasks();
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

    tasks.push(task);
    await this.writeTasks(tasks);

    return task;
  }

  async completeTask(taskId) {
    const tasks = await this.readTasks();
    const updatedAt = this.now().toISOString();

    for (const task of tasks) {
      if (task.id === taskId) {
        task.status = "done";
        task.updatedAt = updatedAt;
      }
    }

    await this.writeTasks(tasks);
  }

  async nextPendingTask() {
    const tasks = await this.readTasks();
    return tasks.find((task) => task.status === "pending") ?? null;
  }
}
