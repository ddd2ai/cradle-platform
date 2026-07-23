import fs from "fs/promises";
import path from "path";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";
import { writeTextFile } from "../utils/text-file.js";

export class CellEvolutionStore {
  constructor({
    thoughtsDir,
    evolutionsDir,
    evolutionStateFile,
    timestampFormatter,
    now = () => new Date(),
    tail = (content) => content,
  } = {}) {
    if (!thoughtsDir) {
      throw new Error("CellEvolutionStore requires thoughtsDir");
    }

    if (!evolutionStateFile) {
      throw new Error("CellEvolutionStore requires evolutionStateFile");
    }

    if (!evolutionsDir) {
      throw new Error("CellEvolutionStore requires evolutionsDir");
    }

    if (!timestampFormatter) {
      throw new Error("CellEvolutionStore requires timestampFormatter");
    }

    this.thoughtsDir = thoughtsDir;
    this.evolutionsDir = evolutionsDir;
    this.evolutionStateFile = evolutionStateFile;
    this.timestampFormatter = timestampFormatter;
    this.now = now;
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

  async writeEvolutionJournal({ evolution = {}, thoughts = [] } = {}) {
    const current = this.now();
    const filename = `evolution-${this.timestampFormatter(current)}.md`;

    await writeTextFile(
      path.join(this.evolutionsDir, filename),
      `# Evolution

      ## Summary

      ${evolution.summary ?? "(empty)"}

      ## DNA Drift

      \`\`\`json
      ${JSON.stringify(evolution.dnaDrift ?? [], null, 2)}
      \`\`\`

      ## Affinities

      ${(evolution.affinities ?? []).map((item) => `- ${item}`).join("\n")}

      ## Thoughts

      ${thoughts.map((thought) => `- ${thought.file}`).join("\n")}

      ---
      createdAt: ${current.toISOString()}
      `
    );

    return filename;
  }

  createDefaultEvolutionState() {
    return {
      evolvedThoughts: [],
      evolutionCount: 0,
      lastEvolvedAt: null,
    };
  }
}
