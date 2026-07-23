import fs from "fs/promises";
import path from "path";
import { writeTextFile } from "../utils/text-file.js";

export class CellMemoryStore {
  constructor({
    memoryFiles,
    thoughtsDir,
    cellId,
    cellName,
    timestampFormatter,
  } = {}) {
    if (!memoryFiles) {
      throw new Error("CellMemoryStore requires memoryFiles");
    }

    if (!thoughtsDir) {
      throw new Error("CellMemoryStore requires thoughtsDir");
    }

    if (!timestampFormatter) {
      throw new Error("CellMemoryStore requires timestampFormatter");
    }

    this.memoryFiles = memoryFiles;
    this.thoughtsDir = thoughtsDir;
    this.cellId = cellId;
    this.cellName = cellName;
    this.timestampFormatter = timestampFormatter;
  }

  async prepareMemoryFiles() {
    await this.ensureFile(
      this.memoryFiles.identity,
      `# Identity

      I am ${this.cellName}.
      My cell id is ${this.cellId}.

      `
    );

    await this.ensureFile(
      this.memoryFiles.rules,
      `# Rules

      - Use Traditional Chinese.
      - Be concise, clear, and useful.
      - Preserve Cradle Platform context.
      - Grow through memory, workspace, thoughts, and snapshots.
      - Do not treat history as absolute truth; summarize and refine it into knowledge.

      `
    );

    await this.ensureFile(
      this.memoryFiles.knowledge,
      `# Knowledge

      `
    );

    await this.ensureFile(
      this.memoryFiles.history,
      `# History

      `
    );
  }

  async ensureFile(file, content) {
    try {
      await fs.access(file);
    } catch {
      await writeTextFile(file, content);
    }
  }

  async safeReadMemory(name) {
    try {
      return await this.readMemory(name);
    } catch {
      return "";
    }
  }

  async readMemory(name = "knowledge") {
    const file = this.resolveMemoryFile(name);
    return await fs.readFile(file, "utf8");
  }

  async writeMemory(name, content) {
    const file = this.resolveMemoryFile(name);
    await writeTextFile(file, content);
  }

  async appendMemory(name, content) {
    const file = this.resolveMemoryFile(name);
    await fs.appendFile(file, `\n${content}\n`, "utf8");
  }

  async appendKnowledge(content) {
    await this.appendMemory("knowledge", content);
  }

  async appendHistory(content) {
    await this.appendMemory("history", content);
  }

  async appendThought(content) {
    const file = path.join(
      this.thoughtsDir,
      `${this.timestampFormatter(new Date())}.md`
    );

    await writeTextFile(file, content);
  }

  resolveMemoryFile(name) {
    const file = this.memoryFiles[name];

    if (!file) {
      throw new Error(`Unknown memory file: ${name}`);
    }

    return file;
  }
}
