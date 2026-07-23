import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class LivingContextStore {
  constructor({
    livingContextFile,
    now = () => new Date(),
  } = {}) {
    if (!livingContextFile) {
      throw new Error("LivingContextStore requires livingContextFile");
    }

    this.livingContextFile = livingContextFile;
    this.now = now;
  }

  async readLivingContext() {
    return readJsonFile(this.livingContextFile, null);
  }

  async writeLivingContext(context) {
    if (!context || typeof context !== "object") {
      throw new Error("writeLivingContext: context must be an object");
    }

    await writeJsonFile(this.livingContextFile, {
      ...context,
      updatedAt: this.now().toISOString(),
    });
  }
}
