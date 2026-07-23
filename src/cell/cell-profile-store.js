import fs from "fs/promises";

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
    try {
      const raw = await fs.readFile(this.cellFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
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
    await fs.writeFile(
      this.cellFile,
      JSON.stringify(profile, null, 2),
      "utf8"
    );
  }

  async updateStatus(status) {
    try {
      const profile = await this.readCellProfile();
      if (!profile) return;

      profile.status = status;
      profile.updatedAt = this.now().toISOString();

      await this.writeCellProfile(profile);
    } catch {
      // cell.json write failures should not interrupt CLI flow.
    }
  }

  async increaseMaturity(amount = 1) {
    try {
      const profile = await this.readCellProfile();
      if (!profile) return;

      profile.maturity = Number(profile.maturity ?? 0) + amount;
      profile.updatedAt = this.now().toISOString();

      await this.writeCellProfile(profile);
    } catch {
      // Legacy maturity updates should not interrupt CLI flow.
    }
  }

  async getProfile() {
    return (await this.readCellProfile()) || {};
  }

  async getStatus() {
    const profile = await this.readCellProfile();
    return profile?.status ?? "unknown";
  }

  async setGeneration(generation) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    profile.generation = generation;
    profile.updatedAt = this.now().toISOString();

    await this.writeCellProfile(profile);
  }

  async setParent(parentId) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    profile.parent = parentId;
    profile.updatedAt = this.now().toISOString();

    await this.writeCellProfile(profile);
  }

  async addResponsibility(name) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    profile.responsibilities ??= [];

    if (!profile.responsibilities.includes(name)) {
      profile.responsibilities.push(name);
    }

    await this.writeCellProfile(profile);
  }

  async removeResponsibility(name) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    profile.responsibilities = (profile.responsibilities ?? [])
      .filter((item) => item !== name);

    await this.writeCellProfile(profile);
  }

  async setResponsibilities(responsibilities = []) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    profile.responsibilities = this.cleanResponsibilities(responsibilities);
    profile.updatedAt = this.now().toISOString();

    await this.writeCellProfile(profile);
  }

  async listResponsibilities() {
    const profile = await this.readCellProfile();
    return profile?.responsibilities ?? [];
  }

  async addRelationship(type, target) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    profile.relationships ??= [];

    profile.relationships.push({
      type,
      target,
    });

    await this.writeCellProfile(profile);
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
}
