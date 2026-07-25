import path from "path";
import fs from "fs/promises";
import { writeTextFile } from "../utils/text-file.js";

export const STIMULUS_CATEGORIES = Object.freeze([
  "signals",
  "threats",
  "pressures",
  "resources",
]);

export class StimulusStore {
  constructor({
    stimuliDir,
    timestampFormatter,
  } = {}) {
    if (!stimuliDir) {
      throw new Error("StimulusStore requires stimuliDir");
    }

    if (!timestampFormatter) {
      throw new Error("StimulusStore requires timestampFormatter");
    }

    this.stimuliDir = stimuliDir;
    this.timestampFormatter = timestampFormatter;
  }

  async writeStimulus({ category = "signals", name, content = "" } = {}) {
    if (!STIMULUS_CATEGORIES.includes(category)) {
      throw new Error(`Invalid stimulus category: ${category}`);
    }

    const filename =
      name || `stimulus-${this.timestampFormatter(new Date())}.md`;
    const dir = path.join(this.stimuliDir, category);
    const filePath = path.join(dir, filename);

    await writeTextFile(filePath, content);

    return {
      category,
      file: filename,
      path: filePath,
    };
  }

  async readStimuli() {
    const results = [];

    for (const category of STIMULUS_CATEGORIES) {
      const dir = path.join(this.stimuliDir, category);

      try {
        const files = await fs.readdir(dir);

        for (const file of files) {
          if (!file.endsWith(".md")) continue;

          const filePath = path.join(dir, file);
          const content = await fs.readFile(filePath, "utf8");

          results.push({
            category,
            file,
            path: filePath,
            content,
          });
        }
      } catch {
        // Missing category directories simply mean no stimuli for that category.
      }
    }

    return results;
  }

  async archiveStimuli(stimuli = []) {
    const processedDir = path.join(this.stimuliDir, "processed");

    await fs.mkdir(processedDir, { recursive: true });

    for (const item of stimuli) {
      const from = path.join(this.stimuliDir, item.category, item.file);
      const to = path.join(
        processedDir,
        `${item.category}-${this.timestampFormatter(new Date())}-${item.file}`
      );

      try {
        await fs.rename(from, to);
      } catch {
        // Ignore stimuli that were already moved or deleted.
      }
    }
  }
}
