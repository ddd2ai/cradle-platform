import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class CellInboxStore {
  constructor({
    inboxDir,
    inboxFile,
    consumerId = "unknown",
    metrics = null,
  } = {}) {
    if (!inboxDir) {
      throw new Error("CellInboxStore requires inboxDir");
    }

    if (!inboxFile) {
      throw new Error("CellInboxStore requires inboxFile");
    }

    this.inboxDir = inboxDir;
    this.inboxFile = inboxFile;
    this.queueDir = path.join(inboxDir, "queue");
    this.claimsDir = path.join(inboxDir, "claims");
    this.consumerId = consumerId;
    this.metrics = metrics;
  }

  async readInbox() {
    const legacy = await readJsonFile(this.inboxFile, []);
    const queued = await this.#readQueueDirectory(this.queueDir);
    return [...legacy, ...queued].sort(compareMessages);
  }

  async writeInbox(messages = []) {
    await fs.rm(this.queueDir, { recursive: true, force: true });
    await writeJsonFile(this.inboxFile, [], { dir: this.inboxDir });

    for (const message of messages) {
      await this.appendInboxMessage(message);
    }
  }

  async appendInboxMessage(message) {
    await fs.mkdir(this.queueDir, { recursive: true });
    const createdAt = Date.parse(message?.createdAt ?? "") || Date.now();
    const messageId = sanitizeFilePart(message?.id ?? randomUUID());
    const file = `${String(createdAt).padStart(13, "0")}-${messageId}.json`;
    await writeJsonFile(path.join(this.queueDir, file), message);
    this.metrics?.increment("inbox_messages_received", 1, { cellId: this.consumerId });
    return message;
  }

  async claimInbox() {
    const claimId = randomUUID();
    const claimDir = path.join(this.claimsDir, claimId);
    await fs.mkdir(claimDir, { recursive: true });

    const legacy = await readJsonFile(this.inboxFile, []);
    if (legacy.length > 0) {
      await writeJsonFile(this.inboxFile, [], { dir: this.inboxDir });
      for (const message of legacy) {
        const file = `legacy-${randomUUID()}.json`;
        await writeJsonFile(path.join(claimDir, file), message);
      }
    }

    let files = [];
    try {
      files = (await fs.readdir(this.queueDir)).filter((file) => file.endsWith(".json"));
    } catch {
      // An absent queue is an empty queue.
    }

    for (const file of files) {
      try {
        await fs.rename(path.join(this.queueDir, file), path.join(claimDir, file));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }

    const messages = await this.#readQueueDirectory(claimDir);
    if (messages.length === 0) {
      await fs.rm(claimDir, { recursive: true, force: true });
      return { claimId: null, messages: [] };
    }

    this.metrics?.increment("inbox_messages_claimed", messages.length, {
      cellId: this.consumerId,
    });
    for (const message of messages) {
      this.metrics?.observe(
        "inbox_queue_age_ms",
        Math.max(0, Date.now() - Date.parse(message.createdAt ?? new Date())),
        { cellId: this.consumerId }
      );
    }
    return { claimId, messages };
  }

  async acknowledgeClaim(claimId) {
    if (!claimId) return;
    await fs.rm(path.join(this.claimsDir, claimId), { recursive: true, force: true });
  }

  async releaseClaim(claimId) {
    if (!claimId) return;
    const claimDir = path.join(this.claimsDir, claimId);
    await fs.mkdir(this.queueDir, { recursive: true });

    let files = [];
    try {
      files = await fs.readdir(claimDir);
    } catch {
      return;
    }

    for (const file of files) {
      try {
        await fs.rename(path.join(claimDir, file), path.join(this.queueDir, file));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    await fs.rm(claimDir, { recursive: true, force: true });
  }

  async clearInbox() {
    await fs.rm(this.queueDir, { recursive: true, force: true });
    await writeJsonFile(this.inboxFile, [], { dir: this.inboxDir });
  }

  async #readQueueDirectory(dir) {
    let files = [];
    try {
      files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json")).sort();
    } catch {
      return [];
    }

    const messages = [];
    for (const file of files) {
      const message = await readJsonFile(path.join(dir, file), null);
      if (message) messages.push(message);
    }
    return messages;
  }
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function compareMessages(a, b) {
  return String(a?.createdAt ?? "").localeCompare(String(b?.createdAt ?? ""));
}
