import fs from "fs/promises";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class CellProfileStore {
  constructor({
    cellFile,
    profileFile,
    now = () => new Date(),
  } = {}) {
    if (!cellFile) {
      throw new Error("CellProfileStore requires cellFile");
    }

    if (!profileFile) {
      throw new Error("CellProfileStore requires profileFile");
    }

    this.cellFile = cellFile;
    this.profileFile = profileFile;
    this.now = now;
  }

  async readCellProfile() {
    return readJsonFile(this.cellFile, null);
  }

  async readProfile() {
    try {
      const raw = await fs.readFile(this.profileFile, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async writeCellProfile(profile) {
    await writeJsonFile(this.cellFile, profile);
  }

  async updateStatus(status) {
    await this.updateCellProfile((profile) => {
      profile.status = status;
    }, { touch: true, silent: true });
  }

  async increaseMaturity(amount = 1) {
    await this.updateCellProfile((profile) => {
      profile.maturity = Number(profile.maturity ?? 0) + amount;
    }, { touch: true, silent: true });
  }

  async getProfile() {
    return (await this.readCellProfile()) || {};
  }

  async getStatus() {
    const profile = await this.readCellProfile();
    return profile?.status ?? "unknown";
  }

  async setGeneration(generation) {
    await this.updateCellProfile((profile) => {
      profile.generation = generation;
    }, { touch: true });
  }

  async setParent(parentId) {
    await this.updateCellProfile((profile) => {
      profile.parent = parentId;
    }, { touch: true });
  }

  async addResponsibility(name) {
    await this.updateCellProfile((profile) => {
      profile.responsibilities ??= [];

      if (!profile.responsibilities.includes(name)) {
        profile.responsibilities.push(name);
      }
    });
  }

  async removeResponsibility(name) {
    await this.updateCellProfile((profile) => {
      profile.responsibilities = (profile.responsibilities ?? [])
        .filter((item) => item !== name);
    });
  }

  async setResponsibilities(responsibilities = []) {
    await this.updateCellProfile((profile) => {
      profile.responsibilities = this.cleanResponsibilities(responsibilities);
    }, { touch: true });
  }

  async listResponsibilities() {
    const profile = await this.readCellProfile();
    return profile?.responsibilities ?? [];
  }

  async addRelationship(type, target) {
    await this.updateCellProfile((profile) => {
      profile.relationships ??= [];

      profile.relationships.push({
        type,
        target,
      });
    });
  }

  async listRelationships() {
    const profile = await this.readCellProfile();
    return profile?.relationships ?? [];
  }

  cleanResponsibilities(responsibilities = []) {
    return [
      ...new Set(
        (responsibilities || [])
          .map((responsibility) => String(responsibility).trim())
          .filter((responsibility) => responsibility.length > 0)
      ),
    ];
  }

  async updateCellProfile(mutator, { touch = false, silent = false } = {}) {
    try {
      const profile = await this.readCellProfile();

      if (!profile) return;

      mutator(profile);

      if (touch) {
        profile.updatedAt = this.now().toISOString();
      }

      await this.writeCellProfile(profile);
    } catch (error) {
      if (!silent) {
        throw error;
      }
    }
  }
}
