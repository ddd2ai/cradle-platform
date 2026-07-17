import fs from "fs/promises";
import path from "path";

export class CradleSnapshotService {
  constructor({ engine, situationDir = "situation" } = {}) {
    if (!engine) {
      throw new Error("CradleSnapshotService requires engine");
    }

    this.engine = engine;
    this.situationDir = situationDir;
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
    const lifecycle = await cell.getLifecycleDecision().catch(() => null);
    const dnaVector = await cell.readDNAVector().catch(() => ({}));
    const relationships = await cell.listRelationships().catch(() => []);
    const tasks = await cell.readTasks().catch(() => []);
    const artifactSummary = await cell.artifactStore?.listArtifactSummaries?.().catch(() => ({ artifacts: [] }));
    const recentFailures = await this._recentFailuresFor(cell.id);

    return {
      cellId: cell.id,
      purpose: livingContext?.purpose ?? profile?.purpose ?? null,
      responsibilities: livingContext?.responsibilities ?? profile?.responsibilities ?? [],
      owns: livingContext?.owns ?? [],
      maturity,
      lifecycleState: lifecycle?.action ?? maturity?.state ?? null,
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
      return entries
        .filter((entry) => entry.isFile())
        .slice(-10)
        .map((entry) => ({
          file: entry.name,
        }));
    } catch {
      return [];
    }
  }

  async _recentFailuresFor(cellId) {
    const threats = await this._readStimulusCategory(
      path.join(this.situationDir, "stimuli", "threats")
    );

    return threats
      .filter((item) => item.file.includes(cellId) || !item.file.includes("cell-"))
      .slice(-5);
  }
}
