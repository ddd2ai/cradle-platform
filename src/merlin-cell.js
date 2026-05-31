// merlin-cell.js
import fs from "fs/promises";
import path from "path";
import { createMerlinAssistant } from "./merlin-ai.js";
import {
  renderError,
  renderSkill,
  renderSkillNotFound,
  writeAssistantChunk,
} from "./merlin-ui.js";

export class MerlinCell {
  constructor({
    id = "cell-001",
    name = "Merlin Cell",
    model = "gpt-4.1",
  } = {}) {
    this.id = id;
    this.name = name;
    this.model = model;

    this.rootDir = path.join("cells", this.id);
    this.logsDir = path.join(this.rootDir, "logs");
    this.memoryDir = path.join(this.rootDir, "memory");
    this.workspaceDir = path.join(this.rootDir, "workspace");
    this.snapshotsDir = path.join(this.rootDir, "snapshots");
    this.cellFile = path.join(this.rootDir, "cell.json");

    this.assistant = null;
  }

  async prepare() {
    await this.prepareCellDirectory();

    this.assistant = await createMerlinAssistant({
      model: this.model,
      onDelta: writeAssistantChunk,
      onError: renderError,
      logDir: this.logsDir,
      cellId: this.id,
      cellName: this.name,
    });

    await this.updateStatus("idle");
  }

  async ask(input) {
    if (!this.assistant) {
      throw new Error(`Cell ${this.id} has not been prepared.`);
    }

    await this.updateStatus("running");

    try {
      const result = await this.assistant.ask(input);

      if (result.usedSkill) {
        renderSkill(result.usedSkill);
      }

      if (result.skillMissing) {
        renderSkillNotFound(result.skillMissing);
      }

      await this.updateStatus("idle");

      return result;
    } catch (error) {
      await this.updateStatus("error");
      throw error;
    }
  }

  async prepareCellDirectory() {
    await Promise.all([
      fs.mkdir(this.logsDir, { recursive: true }),
      fs.mkdir(this.memoryDir, { recursive: true }),
      fs.mkdir(this.workspaceDir, { recursive: true }),
      fs.mkdir(this.snapshotsDir, { recursive: true }),
    ]);

    const now = new Date().toISOString();

    const defaultProfile = {
      id: this.id,
      name: this.name,
      model: this.model,
      status: "idle",
      maturity: 0,
      createdAt: now,
      updatedAt: now,
      lastStartedAt: now,
      directories: {
        root: this.rootDir,
        logs: this.logsDir,
        memory: this.memoryDir,
        workspace: this.workspaceDir,
        snapshots: this.snapshotsDir,
      },
    };

    const existingProfile = await this.readCellProfile();

    const nextProfile = existingProfile
      ? {
          ...existingProfile,
          name: existingProfile.name || this.name,
          model: this.model,
          status: "idle",
          updatedAt: now,
          lastStartedAt: now,
          directories: defaultProfile.directories,
        }
      : defaultProfile;

    await this.writeCellProfile(nextProfile);
  }

  async readCellProfile() {
    try {
      const raw = await fs.readFile(this.cellFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async writeCellProfile(profile) {
    await fs.writeFile(this.cellFile, JSON.stringify(profile, null, 2), "utf8");
  }

  async updateStatus(status) {
    try {
      const profile = await this.readCellProfile();

      if (!profile) {
        return;
      }

      profile.status = status;
      profile.updatedAt = new Date().toISOString();

      await this.writeCellProfile(profile);
    } catch {
      // cell.json 寫入失敗不應該中斷 CLI
    }
  }

  async shutdown() {
    await this.updateStatus("stopped");
    await this.assistant?.cleanup();
  }
}