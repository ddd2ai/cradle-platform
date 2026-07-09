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
}
