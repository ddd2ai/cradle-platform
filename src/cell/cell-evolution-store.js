import fs from "fs/promises";
import path from "path";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class CellEvolutionStore {
  constructor({
    thoughtsDir,
    evolutionStateFile,
    tail = (content) => content,
  } = {}) {
    if (!thoughtsDir) {
      throw new Error("CellEvolutionStore requires thoughtsDir");
    }

    if (!evolutionStateFile) {
      throw new Error("CellEvolutionStore requires evolutionStateFile");
    }

    this.thoughtsDir = thoughtsDir;
    this.evolutionStateFile = evolutionStateFile;
    this.tail = tail;
  }

  async readRecentThoughts(maxChars = 4000) {
    try {
      const markdownFiles = (await this.listThoughtFiles()).slice(-5);
      const contents = [];

      for (const file of markdownFiles) {
        const fullPath = path.join(this.thoughtsDir, file);
        const content = await fs.readFile(fullPath, "utf8");
        contents.push(`# ${file}\n\n${content}`);
      }

      return this.tail(contents.join("\n\n---\n\n"), maxChars);
    } catch {
      return "";
    }
  }

  async readEvolutionState() {
    return readJsonFile(
      this.evolutionStateFile,
      this.createDefaultEvolutionState()
    );
  }

  async writeEvolutionState(state) {
    await writeJsonFile(this.evolutionStateFile, state);
  }

  async listThoughtFiles() {
    try {
      const files = await fs.readdir(this.thoughtsDir);
      return files
        .filter((file) => file.endsWith(".md"))
        .sort();
    } catch {
      return [];
    }
  }

  async loadUnevolvedThoughts(limit = 5) {
    const state = await this.readEvolutionState();
    const files = await this.listThoughtFiles();

    const unevolved = files
      .filter((file) => !state.evolvedThoughts.includes(file))
      .slice(0, limit);

    const thoughts = [];

    for (const file of unevolved) {
      const content = await fs.readFile(
        path.join(this.thoughtsDir, file),
        "utf8"
      );

      thoughts.push({
        file,
        content,
      });
    }

    return thoughts;
  }

  createDefaultEvolutionState() {
    return {
      evolvedThoughts: [],
      evolutionCount: 0,
      lastEvolvedAt: null,
    };
  }
}
