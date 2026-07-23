import fs from "fs/promises";
import path from "path";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class LifecycleProposalStore {
  constructor({ dir = path.join("situation", "proposals") } = {}) {
    this.dir = dir;
  }

  async save(record) {
    await fs.mkdir(this.dir, { recursive: true });

    const proposalId =
      record.proposal?.proposalId ||
      `proposal-${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;

    const file = `${proposalId}.json`;
    const saved = {
      ...record,
      proposal: {
        ...(record.proposal || {}),
        proposalId,
      },
      savedAt: new Date().toISOString(),
    };

    await writeJsonFile(path.join(this.dir, file), saved);

    return {
      proposalId,
      file,
      path: path.join(this.dir, file),
      record: saved,
    };
  }

  async list({ status = null } = {}) {
    await fs.mkdir(this.dir, { recursive: true });

    const entries = await fs.readdir(this.dir, { withFileTypes: true });
    const records = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const record = await readJsonFile(path.join(this.dir, entry.name), null);

      if (!record || (status && record.proposal?.status !== status)) {
        continue;
      }

      records.push({
        file: entry.name,
        ...record,
      });
    }

    return records.sort((a, b) =>
      String(b.savedAt || "").localeCompare(String(a.savedAt || ""))
    );
  }
}
