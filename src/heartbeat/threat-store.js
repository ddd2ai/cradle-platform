import fs from "fs/promises";
import path from "path";
import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

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

    await writeJsonFile(path.join(this.dir, `${threat.threatId}.json`), threat);

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

    await writeJsonFile(filePath, resolved);

    return resolved;
  }

  async resolveForArtifact({
    cellId = null,
    artifactId,
    resolution,
    proposalId = null,
    resolvedAt = new Date().toISOString(),
  } = {}) {
    if (!artifactId) {
      throw new Error("ThreatStore.resolveForArtifact requires artifactId");
    }

    const threats = await this._readAll();
    const matching = threats.filter(
      (threat) =>
        threat.artifactId === artifactId &&
        (!cellId || threat.cellId === cellId) &&
        !threat.resolvedAt
    );

    const resolved = [];
    for (const threat of matching) {
      resolved.push(
        await this.resolve({
          threatId: threat.threatId,
          resolution,
          proposalId,
          resolvedAt,
        })
      );
    }

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

        const data = await readJsonFile(path.join(this.dir, entry.name), null);

        if (!data) {
          continue;
        }

        threats.push({
          file: entry.name,
          ...data,
        });
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
