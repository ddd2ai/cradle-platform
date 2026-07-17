import fs from "fs/promises";
import path from "path";
import { ThreatStore } from "./threat-store.js";

export class CradleSnapshotService {
  constructor({
    engine,
    situationDir = "situation",
    threatStore = new ThreatStore({
      dir: path.join(situationDir, "stimuli", "threats"),
    }),
  } = {}) {
    if (!engine) {
      throw new Error("CradleSnapshotService requires engine");
    }

    this.engine = engine;
    this.situationDir = situationDir;
    this.threatStore = threatStore;
  }

  async create() {
    const observedAt = new Date().toISOString();

    const cells = [];

    for (const cell of this.engine.listCells()) {
      cells.push(await this._summarizeCell(cell));
    }

    return JSON.parse(JSON.stringify({
      observedAt,
      cells,
      stimuli: await this._readStimuli(),
    }));
  }

  async _summarizeCell(cell) {
    const profile = await cell.readCellProfile().catch(() => null);
    const livingContext = await cell.readLivingContext().catch(() => null);
    const maturity = await cell.getMaturityInfo().catch(() => null);
    const dnaVector = await cell.readDNAVector().catch(() => ({}));
    const relationships = await cell.listRelationships().catch(() => []);
    const tasks = await cell.readTasks().catch(() => []);
    const artifactSummary = await cell.artifactStore?.listArtifactSummaries?.().catch(() => ({ artifacts: [] }));
    const recentFailures =
      await this.threatStore.listUnresolvedForCell(cell.id);

    return {
      cellId: cell.id,
      purpose: livingContext?.purpose ?? profile?.purpose ?? null,
      responsibilities: livingContext?.responsibilities ?? profile?.responsibilities ?? [],
      owns: livingContext?.owns ?? [],
      maturity,
      maturityState: maturity?.state ?? null,
      dnaSummary: this._summarizeDNA(dnaVector),
      relationships,
      artifactCount: artifactSummary?.artifacts?.length ?? 0,
      taskCount: tasks.filter((task) => task.status !== "done").length,
      threatCount: recentFailures.length,
      recentFailures,
    };
  }

  _summarizeDNA(dnaVector = {}) {
    return Object.fromEntries(
      Object.entries(dnaVector).map(([trait, factors]) => [
        trait,
        {
          strength: factors?.strength ?? null,
          stability: factors?.stability ?? null,
          fitness: factors?.fitness ?? null,
          plasticity: factors?.plasticity ?? null,
        },
      ])
    );
  }

  async _readStimuli() {
    const categories = ["signals", "pressures", "threats", "resources"];
    const result = {};

    for (const category of categories) {
      const dir = path.join(this.situationDir, "stimuli", category);
      result[category] = await this._readStimulusCategory(dir);
    }

    return result;
  }

  async _readStimulusCategory(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const items = [];

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const filePath = path.join(dir, entry.name);

        try {
          const raw = await fs.readFile(filePath, "utf8");
          const data = JSON.parse(raw);
          items.push({
            file: entry.name,
            ...data,
          });
        } catch {
          items.push({
            file: entry.name,
          });
        }
      }

      return items.slice(-10);
    } catch {
      return [];
    }
  }
}
