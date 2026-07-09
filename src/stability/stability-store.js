import fs from "fs/promises";
import path from "path";

export class StabilityStore {
  constructor({ rootDir }) {
    this.rootDir = rootDir;
    this.file = path.join(rootDir, "stability.json");
  }

  async read() {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return JSON.parse(raw);
    } catch {
      return {
        artifacts: {},
      };
    }
  }

  async write(state) {
    await fs.writeFile(
      this.file,
      JSON.stringify(state, null, 2),
      "utf8"
    );
  }

  async appendArtifactRecord(artifactId, record) {
    const state = await this.read();

    state.artifacts[artifactId] ??= {
      artifactId,
      status: "unstable",
      consecutivePassed: 0,
      consecutiveNoTask: 0,
      repairCount: 0,
      records: [],
      updatedAt: new Date().toISOString(),
    };

    const artifactState = state.artifacts[artifactId];

    artifactState.records.push({
      ...record,
      createdAt: new Date().toISOString(),
    });

    if (record.executionStatus === "passed") {
      artifactState.consecutivePassed += 1;
    } else {
      artifactState.consecutivePassed = 0;
    }

    if (record.createdTasks === 0) {
      artifactState.consecutiveNoTask += 1;
    } else {
      artifactState.consecutiveNoTask = 0;
      artifactState.repairCount += record.createdTasks;
    }

    if (
      artifactState.consecutivePassed >= 2 &&
      artifactState.consecutiveNoTask >= 2
    ) {
      artifactState.status = "stable";
      artifactState.stableAt = new Date().toISOString();
    } else {
      artifactState.status = "stabilizing";
    }

    artifactState.updatedAt = new Date().toISOString();

    await this.write(state);

    return artifactState;
  }

  async getArtifactState(artifactId) {
    const state = await this.read();
    return state.artifacts[artifactId] ?? null;
  }
}
