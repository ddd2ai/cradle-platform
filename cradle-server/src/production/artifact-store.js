import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import { writeJsonFile } from "../utils/json-file.js";
import { writeTextFile } from "../utils/text-file.js";
import { hashArtifactContent } from "./artifact-change-plan.js";

export class ArtifactStore {
  constructor({ productionsDir }) {
    if (!productionsDir) {
      throw new Error("ArtifactStore requires productionsDir");
    }

    this.productionsDir = productionsDir;
  }

  async ensureReady() {
    await fs.mkdir(this.productionsDir, { recursive: true });
  }

  resolveProductionDir(artifactId) {
    return path.join(this.productionsDir, artifactId);
  }

  async saveArtifact(artifact) {
    await this.ensureReady();

    const dir = this.resolveProductionDir(artifact.id);
    const outputsDir = path.join(dir, "outputs");
    const blobsDir = path.join(dir, "blobs");
    const revisionsDir = path.join(dir, "revisions");

    await fs.mkdir(outputsDir, { recursive: true });
    await fs.mkdir(blobsDir, { recursive: true });
    await fs.mkdir(revisionsDir, { recursive: true });

    const currentManifest = await this.#readManifest(artifact.id);
    const revision = artifact.revision ?? {
      revisionId: `rev-${randomUUID()}`,
      baseRevisionId: currentManifest?.revision?.revisionId ?? null,
      mode: "full",
      changedPaths: (artifact.outputs ?? [])
        .filter((output) => output?.kind === "file")
        .map((output) => output.path),
      createdAt: artifact.createdAt ?? new Date().toISOString(),
    };
    const persistedArtifact = { ...artifact, revision };
    const revisionId = sanitizeRevisionId(revision.revisionId);
    await this.#assertExistingRevisionContent(
      path.join(revisionsDir, `${revisionId}.json`),
      persistedArtifact
    );
    const incrementallyChangedPaths = revision.mode === "incremental"
      ? new Set(revision.changedPaths ?? [])
      : null;
    const previousHashes = new Map(
      (currentManifest?.outputs ?? []).map((output) => [
        output.path,
        output.contentHash ?? (
          typeof output.content === "string" ? hashArtifactContent(output.content) : null
        ),
      ])
    );
    const manifestOutputs = [];

    if (persistedArtifact.plan) {
      await writeTextFile(
        path.join(dir, "plan.md"),
        persistedArtifact.plan.markdown ?? JSON.stringify(persistedArtifact.plan, null, 2)
      );
    }

    for (const output of persistedArtifact.outputs ?? []) {
      if (output.kind !== "file") {
        manifestOutputs.push(output);
        continue;
      }

      const content = String(output.content ?? "");
      const canReuseContentHash = Boolean(
        incrementallyChangedPaths &&
        !incrementallyChangedPaths.has(output.path) &&
        output.contentHash
      );
      const contentHash = canReuseContentHash
        ? output.contentHash
        : hashArtifactContent(content);
      const blobPath = path.join(blobsDir, `${contentHash}.blob`);
      if (!canReuseContentHash) {
        await this.#writeBlobOnce(blobPath, content);
      }

      const { content: _content, ...outputMetadata } = output;
      manifestOutputs.push({
        ...outputMetadata,
        contentHash,
        contentBytes: canReuseContentHash
          ? output.contentBytes
          : Buffer.byteLength(content, "utf8"),
      });

      if (previousHashes.get(output.path) === contentHash) continue;
      const outputPath = safeOutputPath(outputsDir, output.path);
      await writeTextFile(outputPath, output.content ?? "");
    }

    const manifest = {
      ...persistedArtifact,
      outputs: manifestOutputs,
    };
    await this.#writeRevisionManifest(
      path.join(revisionsDir, `${revisionId}.json`),
      manifest
    );

    const stagingManifest = path.join(dir, `.artifact-${randomUUID()}.json`);
    await writeJsonFile(stagingManifest, manifest, { dir });
    await fs.rename(stagingManifest, path.join(dir, "artifact.json"));

    return {
      artifactId: persistedArtifact.id,
      dir,
      revisionId: revision.revisionId,
    };
  }

  async saveArtifactRevision(artifact) {
    if (!artifact?.revision?.revisionId) {
      throw new Error("saveArtifactRevision requires artifact.revision.revisionId");
    }
    return await this.saveArtifact(artifact);
  }

  async readArtifact(artifactId) {
    const manifest = await this.#readManifest(artifactId);
    if (!manifest) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    return await this.#hydrateArtifact(artifactId, manifest);
  }

  async readArtifactRevision(artifactId, revisionId) {
    const file = path.join(
      this.resolveProductionDir(artifactId),
      "revisions",
      `${sanitizeRevisionId(revisionId)}.json`
    );
    const raw = await fs.readFile(file, "utf8");
    return await this.#hydrateArtifact(artifactId, JSON.parse(raw));
  }

  async restoreArtifactRevision(artifactId, revisionId) {
    const current = await this.readArtifact(artifactId);
    const restored = await this.readArtifactRevision(artifactId, revisionId);
    const now = new Date().toISOString();
    const next = {
      ...restored,
      revision: {
        revisionId: `rev-${randomUUID()}`,
        baseRevisionId: current.revision?.revisionId ?? null,
        mode: "rollback",
        restoredRevisionId: revisionId,
        changedPaths: restored.outputs
          .filter((output) => output?.kind === "file")
          .map((output) => output.path),
        createdAt: now,
      },
      updatedAt: now,
    };
    await this.saveArtifactRevision(next);
    return next;
  }

  async listArtifacts() {
    await this.ensureReady();

    const entries = await fs.readdir(this.productionsDir, {
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  /**
   * 列出所有 Artifacts 的摘要 (只有 metadata，不載入完整內容)
   * 
   * @returns {Promise<Object>} { artifacts: [...], errors: [...] }
   */
  async listArtifactSummaries() {
    const artifactIds = await this.listArtifacts();
    const artifacts = [];
    const errors = [];

    for (const artifactId of artifactIds) {
      try {
        const artifact = await this.#readManifest(artifactId);
        if (!artifact) {
          throw new Error(`Artifact not found: ${artifactId}`);
        }

        // 只保留 metadata，不包含 outputs 的 content
        const summary = {
          artifactId: artifact.id,
          type: artifact.type,
          title: artifact.title,
          goal: artifact.goal,
          status: artifact.status,
          outputPaths: artifact.outputs
            ? artifact.outputs.map(o => o.path).filter(Boolean)
            : [],
          languages: artifact.languages || [],
          notes: artifact.notes || ""
        };

        artifacts.push(summary);
      } catch (error) {
        // 單一 Artifact 損壞時記錄錯誤，不中斷整個流程
        errors.push({
          artifactId,
          error: error.message
        });
      }
    }

    return { artifacts, errors };
  }

  /**
   * 讀取多個 Artifacts
   * 
   * @param {string[]} artifactIds - Artifact IDs
   * @returns {Promise<Array>} Artifacts
   */
  async readArtifacts(artifactIds = []) {
    const artifacts = [];

    for (const artifactId of artifactIds) {
      try {
        const artifact = await this.readArtifact(artifactId);
        artifacts.push(artifact);
      } catch (error) {
        console.warn(`readArtifacts: Failed to read ${artifactId}:`, error.message);
        // 繼續讀取其他 artifacts
      }
    }

    return artifacts;
  }

  async #readManifest(artifactId) {
    try {
      const file = path.join(
        this.resolveProductionDir(artifactId),
        "artifact.json"
      );
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async #hydrateArtifact(artifactId, manifest) {
    const dir = this.resolveProductionDir(artifactId);
    const outputs = [];
    for (const output of manifest.outputs ?? []) {
      if (output?.kind !== "file" || typeof output.content === "string") {
        outputs.push(output);
        continue;
      }

      let content;
      if (output.contentHash) {
        content = await fs.readFile(
          path.join(dir, "blobs", `${output.contentHash}.blob`),
          "utf8"
        );
      } else {
        content = await fs.readFile(
          safeOutputPath(path.join(dir, "outputs"), output.path),
          "utf8"
        );
      }
      outputs.push({ ...output, content });
    }
    return { ...manifest, outputs };
  }

  async #writeBlobOnce(file, content) {
    try {
      await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }

  async #writeRevisionManifest(file, value) {
    try {
      await fs.writeFile(file, JSON.stringify(value, null, 2), {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = JSON.parse(await fs.readFile(file, "utf8"));
      if (revisionContentFingerprint(existing) !== revisionContentFingerprint(value)) {
        throw new Error(`Artifact revision content is immutable: ${value.revision?.revisionId}`);
      }
    }
  }

  async #assertExistingRevisionContent(file, value) {
    try {
      const existing = JSON.parse(await fs.readFile(file, "utf8"));
      if (revisionContentFingerprint(existing) !== revisionContentFingerprint(value)) {
        throw new Error(`Artifact revision content is immutable: ${value.revision?.revisionId}`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function revisionContentFingerprint(manifest) {
  return JSON.stringify(
    (manifest.outputs ?? []).map((output) => ({
      kind: output?.kind,
      path: output?.path,
      contentHash: typeof output?.content === "string"
        ? hashArtifactContent(output.content)
        : output?.contentHash ?? null,
    }))
  );
}

function safeOutputPath(outputsDir, outputPath) {
  const root = path.resolve(outputsDir);
  const target = path.resolve(root, outputPath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Output path escapes artifact directory: ${outputPath}`);
  }
  return target;
}

function sanitizeRevisionId(revisionId) {
  const value = String(revisionId ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!value) throw new Error("Artifact revision id is required");
  return value;
}
