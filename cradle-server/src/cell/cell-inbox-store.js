import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

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
    return readJsonFile(this.inboxFile, []);
  }

  async writeInbox(messages = []) {
    await writeJsonFile(this.inboxFile, messages, { dir: this.inboxDir });
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
