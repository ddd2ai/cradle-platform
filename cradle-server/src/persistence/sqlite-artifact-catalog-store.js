import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export class SqliteArtifactCatalogStore {
  constructor({ file } = {}) {
    if (!file) throw new Error("SqliteArtifactCatalogStore requires file");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS artifact_records (
      artifact_id TEXT PRIMARY KEY,
      owner_cell_id TEXT,
      type TEXT NOT NULL,
      title TEXT,
      goal TEXT,
      status TEXT,
      current_revision_id TEXT,
      storage_dir TEXT NOT NULL,
      output_paths_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_artifact_records_owner_cell
      ON artifact_records(owner_cell_id, updated_at DESC);`);
    this.upsert = this.db.prepare(`INSERT INTO artifact_records
      (artifact_id, owner_cell_id, type, title, goal, status, current_revision_id, storage_dir, output_paths_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(artifact_id) DO UPDATE SET owner_cell_id=excluded.owner_cell_id,
      type=excluded.type, title=excluded.title, goal=excluded.goal, status=excluded.status,
      current_revision_id=excluded.current_revision_id, storage_dir=excluded.storage_dir,
      output_paths_json=excluded.output_paths_json, updated_at=excluded.updated_at`);
    this.selectByCell = this.db.prepare("SELECT * FROM artifact_records WHERE owner_cell_id = ? ORDER BY updated_at DESC");
  }

  upsertManifest({ manifest, storageDir } = {}) {
    if (!manifest?.id) throw new Error("upsertManifest requires manifest.id");
    const outputs = (manifest.outputs ?? []).map((output) => output?.path).filter(Boolean);
    this.upsert.run(manifest.id, manifest.ownerCellId ?? manifest.context?.cellId ?? null,
      manifest.type ?? "unknown", manifest.title ?? null, manifest.goal ?? null,
      manifest.status ?? null, manifest.revision?.revisionId ?? null, storageDir,
      JSON.stringify(outputs), new Date().toISOString());
    return { artifactId: manifest.id, indexed: true };
  }

  listByCell(ownerCellId) {
    return this.selectByCell.all(ownerCellId).map((row) => ({
      ...row,
      outputPaths: JSON.parse(row.output_paths_json),
    }));
  }

  close() { this.db.close(); }
}
