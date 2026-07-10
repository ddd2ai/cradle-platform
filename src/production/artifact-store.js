import fs from "fs/promises";
import path from "path";

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

    await fs.mkdir(outputsDir, { recursive: true });

    await fs.writeFile(
      path.join(dir, "artifact.json"),
      JSON.stringify(artifact, null, 2),
      "utf8"
    );

    if (artifact.plan) {
      await fs.writeFile(
        path.join(dir, "plan.md"),
        artifact.plan.markdown ?? JSON.stringify(artifact.plan, null, 2),
        "utf8"
      );
    }

    for (const output of artifact.outputs ?? []) {
      if (output.kind !== "file") continue;

      const outputPath = path.join(outputsDir, output.path);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      await fs.writeFile(
        outputPath,
        output.content ?? "",
        "utf8"
      );
    }

    return {
      artifactId: artifact.id,
      dir,
    };
  }

  async readArtifact(artifactId) {
    const file = path.join(
      this.resolveProductionDir(artifactId),
      "artifact.json"
    );

    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
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
        const artifact = await this.readArtifact(artifactId);

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
}
