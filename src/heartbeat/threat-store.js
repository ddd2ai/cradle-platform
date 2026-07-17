import fs from "fs/promises";
import path from "path";

export class ThreatStore {
  constructor({ dir = path.join("situation", "stimuli", "threats") } = {}) {
    this.dir = dir;
  }

  async saveExecutionFailure({
    cellId,
    artifactId,
    executionResult,
  } = {}) {
    if (!cellId) {
      throw new Error("ThreatStore.saveExecutionFailure requires cellId");
    }

    if (!artifactId) {
      throw new Error("ThreatStore.saveExecutionFailure requires artifactId");
    }

    const result =
      typeof executionResult?.toJSON === "function"
        ? executionResult.toJSON()
        : executionResult;

    if (!result?.executionId) {
      throw new Error("ThreatStore.saveExecutionFailure requires executionId");
    }

    await fs.mkdir(this.dir, { recursive: true });

    const existing =
      (await this._readAll())
        .find((threat) => threat.executionId === result.executionId);

    if (existing) {
      return existing;
    }

    const createdAt = result.createdAt ?? new Date().toISOString();
    const threat = {
      threatId: this._createThreatId(createdAt),
      type: "artifact-execution-failure",
      cellId,
      artifactId,
      executionId: result.executionId,
      status: result.status,
      stderr: result.stderr ?? "",
      error: result.error ?? null,
      createdAt,
      resolvedAt: null,
      resolution: null,
    };

    await fs.writeFile(
      path.join(this.dir, `${threat.threatId}.json`),
      JSON.stringify(threat, null, 2),
      "utf8"
    );

    return threat;
  }

  async listUnresolvedForCell(cellId) {
    const threats = await this._readAll();

    return threats
      .filter(
        (threat) =>
          threat.cellId === cellId &&
          !threat.resolvedAt
      )
      .sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
  }

  async findLatestForArtifact({ cellId = null, artifactId } = {}) {
    const threats = await this._readAll();

    return threats
      .filter(
        (threat) =>
          threat.artifactId === artifactId &&
          (!cellId || threat.cellId === cellId) &&
          !threat.resolvedAt
      )
      .sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      )[0] ?? null;
  }

  async resolve({
    threatId,
    resolution,
    proposalId = null,
    resolvedAt = new Date().toISOString(),
  } = {}) {
    if (!threatId) {
      throw new Error("ThreatStore.resolve requires threatId");
    }

    const filePath = path.join(this.dir, `${threatId}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    const threat = JSON.parse(raw);
    const resolved = {
      ...threat,
      resolvedAt,
      resolution,
      proposalId,
    };

    await fs.writeFile(
      filePath,
      JSON.stringify(resolved, null, 2),
      "utf8"
    );

    return resolved;
  }

  async _readAll() {
    try {
      const entries = await fs.readdir(this.dir, { withFileTypes: true });
      const threats = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
          continue;
        }

        try {
          const raw = await fs.readFile(path.join(this.dir, entry.name), "utf8");
          const data = JSON.parse(raw);
          threats.push({
            file: entry.name,
            ...data,
          });
        } catch {
          // Ignore corrupt threat files; they should not affect heartbeat.
        }
      }

      return threats;
    } catch {
      return [];
    }
  }

  _createThreatId(createdAt) {
    const timestamp = String(createdAt)
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 8);

    return `threat-${timestamp}-${suffix}`;
  }
}
