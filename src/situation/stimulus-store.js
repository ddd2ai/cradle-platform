import path from "path";
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
}
