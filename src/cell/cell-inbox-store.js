import fs from "fs/promises";

export class CellInboxStore {
  constructor({
    inboxDir,
    inboxFile,
  } = {}) {
    if (!inboxDir) {
      throw new Error("CellInboxStore requires inboxDir");
    }

    if (!inboxFile) {
      throw new Error("CellInboxStore requires inboxFile");
    }

    this.inboxDir = inboxDir;
    this.inboxFile = inboxFile;
  }

  async readInbox() {
    try {
      const raw = await fs.readFile(this.inboxFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async writeInbox(messages = []) {
    await fs.mkdir(this.inboxDir, { recursive: true });
    await fs.writeFile(
      this.inboxFile,
      JSON.stringify(messages, null, 2),
      "utf8"
    );
  }

  async appendInboxMessage(message) {
    const messages = await this.readInbox();
    messages.push(message);
    await this.writeInbox(messages);
    return messages;
  }

  async clearInbox() {
    await this.writeInbox([]);
  }
}
