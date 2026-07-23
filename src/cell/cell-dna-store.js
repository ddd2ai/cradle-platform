import fs from "fs/promises";

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
    try {
      const raw = await fs.readFile(this.dnaVectorFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async writeDNAVector(vector) {
    await fs.writeFile(
      this.dnaVectorFile,
      JSON.stringify(vector, null, 2),
      "utf8"
    );
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
    try {
      const raw = await fs.readFile(
        this.dnaHistoryFile,
        "utf8"
      );

      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async writeDNAHistory(history = []) {
    await fs.writeFile(
      this.dnaHistoryFile,
      JSON.stringify(history, null, 2),
      "utf8"
    );
  }
}
