import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class CellDNAStore {
  constructor({
    dnaVectorFile,
    dnaHistoryFile,
    now = () => new Date(),
  } = {}) {
    if (!dnaVectorFile) {
      throw new Error("CellDNAStore requires dnaVectorFile");
    }

    if (!dnaHistoryFile) {
      throw new Error("CellDNAStore requires dnaHistoryFile");
    }

    this.dnaVectorFile = dnaVectorFile;
    this.dnaHistoryFile = dnaHistoryFile;
    this.now = now;
  }

  async readDNAVector() {
    return readJsonFile(this.dnaVectorFile, null);
  }

  async writeDNAVector(vector) {
    await writeJsonFile(this.dnaVectorFile, vector);
  }

  async appendDNAHistory(reason = "unknown") {
    const vector = await this.readDNAVector();

    if (!vector) return;

    const history = await this.readDNAHistory();

    history.push({
      at: this.now().toISOString(),
      reason,
      vector,
    });

    await this.writeDNAHistory(history);
  }

  async appendDNAHistoryIfChanged(reason = "unknown") {
    const vector = await this.readDNAVector();

    if (!vector) return false;

    const history = await this.readDNAHistory();
    const latest = history.at(-1)?.vector;

    if (JSON.stringify(latest) === JSON.stringify(vector)) {
      return false;
    }

    await this.appendDNAHistory(reason);
    return true;
  }

  async readDNAHistory() {
    return readJsonFile(this.dnaHistoryFile, []);
  }

  async writeDNAHistory(history = []) {
    await writeJsonFile(this.dnaHistoryFile, history);
  }
}
