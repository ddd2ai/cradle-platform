import fs from "fs/promises";
import path from "path";

export class CellSnapshotStore {
  constructor({
    cellId,
    snapshotsDir,
    memoryDir,
    workspaceDir,
    thoughtsDir,
    cellFile,
    timestampFormatter,
    now = () => new Date(),
  } = {}) {
    if (!cellId) {
      throw new Error("CellSnapshotStore requires cellId");
    }

    if (!snapshotsDir) {
      throw new Error("CellSnapshotStore requires snapshotsDir");
    }

    if (!memoryDir) {
      throw new Error("CellSnapshotStore requires memoryDir");
    }

    if (!workspaceDir) {
      throw new Error("CellSnapshotStore requires workspaceDir");
    }

    if (!thoughtsDir) {
      throw new Error("CellSnapshotStore requires thoughtsDir");
    }

    if (!cellFile) {
      throw new Error("CellSnapshotStore requires cellFile");
    }

    if (!timestampFormatter) {
      throw new Error("CellSnapshotStore requires timestampFormatter");
    }

    this.cellId = cellId;
    this.snapshotsDir = snapshotsDir;
    this.memoryDir = memoryDir;
    this.workspaceDir = workspaceDir;
    this.thoughtsDir = thoughtsDir;
    this.cellFile = cellFile;
    this.timestampFormatter = timestampFormatter;
    this.now = now;
  }

  async createSnapshot(name = null) {
    const current = this.now();
    const timestamp = this.timestampFormatter(current);
    const snapshotName = name || `snapshot-${timestamp}`;
    const snapshotDir = path.join(this.snapshotsDir, snapshotName);

    await fs.mkdir(snapshotDir, { recursive: true });

    await this.copyDirectory(this.memoryDir, path.join(snapshotDir, "memory"));
    await this.copyDirectory(this.workspaceDir, path.join(snapshotDir, "workspace"));
    await this.copyDirectory(this.thoughtsDir, path.join(snapshotDir, "thoughts"));

    await fs.copyFile(this.cellFile, path.join(snapshotDir, "cell.json"));

    const manifest = {
      cellId: this.cellId,
      snapshot: snapshotName,
      createdAt: current.toISOString(),
      includes: ["cell.json", "memory", "workspace", "thoughts"],
    };

    await fs.writeFile(
      path.join(snapshotDir, "snapshot.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    return snapshotName;
  }

  async listSnapshots() {
    try {
      const entries = await fs.readdir(this.snapshotsDir, {
        withFileTypes: true,
      });

      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  async restoreSnapshot(snapshotName) {
    if (!snapshotName) {
      throw new Error("Snapshot name is required.");
    }

    const snapshotDir = path.join(this.snapshotsDir, snapshotName);
    await fs.access(snapshotDir);

    await fs.rm(this.memoryDir, { recursive: true, force: true });
    await fs.rm(this.workspaceDir, { recursive: true, force: true });
    await fs.rm(this.thoughtsDir, { recursive: true, force: true });

    await this.copyDirectory(path.join(snapshotDir, "memory"), this.memoryDir);
    await this.copyDirectory(path.join(snapshotDir, "workspace"), this.workspaceDir);
    await this.copyDirectory(path.join(snapshotDir, "thoughts"), this.thoughtsDir);

    try {
      await fs.copyFile(path.join(snapshotDir, "cell.json"), this.cellFile);
    } catch {
      // Old snapshots may not contain cell.json.
    }
  }

  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });

    try {
      const entries = await fs.readdir(source, { withFileTypes: true });

      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath);
        } else {
          await fs.copyFile(sourcePath, targetPath);
        }
      }
    } catch {
      // Missing source creates an empty target directory.
    }
  }
}
