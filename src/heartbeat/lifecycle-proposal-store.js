import fs from "fs/promises";
import path from "path";

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

    await fs.writeFile(
      path.join(this.dir, file),
      JSON.stringify(saved, null, 2),
      "utf8"
    );

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

      try {
        const raw = await fs.readFile(path.join(this.dir, entry.name), "utf8");
        const record = JSON.parse(raw);

        if (status && record.proposal?.status !== status) {
          continue;
        }

        records.push({
          file: entry.name,
          ...record,
        });
      } catch {
        // Ignore corrupt proposal records, but keep listing usable records.
      }
    }

    return records.sort((a, b) =>
      String(b.savedAt || "").localeCompare(String(a.savedAt || ""))
    );
  }
}
