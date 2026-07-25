import path from "path";
import { writeTextFile } from "../utils/text-file.js";

export class ObservationStore {
  constructor({
    observationsDir,
    timestampFormatter,
    now = () => new Date(),
  } = {}) {
    if (!observationsDir) {
      throw new Error("ObservationStore requires observationsDir");
    }

    if (!timestampFormatter) {
      throw new Error("ObservationStore requires timestampFormatter");
    }

    this.observationsDir = observationsDir;
    this.timestampFormatter = timestampFormatter;
    this.now = now;
  }

  async writeObservationMarkdown(markdown) {
    const current = this.now();
    const file = `observation-${this.timestampFormatter(current)}.md`;

    await writeTextFile(
      path.join(this.observationsDir, file),
      `# Observation

${markdown}

---
createdAt: ${current.toISOString()}
`
    );

    return file;
  }
}
