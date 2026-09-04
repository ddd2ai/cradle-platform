import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { readJsonFile } from "../utils/json-file.js";

export class SqliteCellLifecycleEventStore {
  constructor({ file, cellId, legacyFile = null, now = () => new Date() } = {}) {
    if (!file || !cellId) {
      throw new Error("SqliteCellLifecycleEventStore requires file and cellId");
    }
    this.file = file;
    this.cellId = cellId;
    this.legacyFile = legacyFile;
    this.now = now;
    this.migrationPromise = null;
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cell_lifecycle_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cell_id TEXT NOT NULL,
        at TEXT NOT NULL,
        event_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cell_lifecycle_events_cell_idx
        ON cell_lifecycle_events(cell_id, event_id);
    `);
  }

  async readLifecycleEvents() {
    await this.#ensureMigrated();
    return this.db.prepare(`
      SELECT event_json FROM cell_lifecycle_events
      WHERE cell_id = ? ORDER BY event_id ASC
    `).all(this.cellId).map((row) => decode(row.event_json));
  }

  async appendLifecycleEvent(event = {}) {
    await this.#ensureMigrated();
    const record = {
      at: this.now().toISOString(),
      ...structuredClone(event),
    };
    this.db.prepare(`
      INSERT INTO cell_lifecycle_events (cell_id, at, event_json)
      VALUES (?, ?, ?)
    `).run(this.cellId, record.at, JSON.stringify(record));
    return record;
  }

  close() {
    this.db.close();
  }

  async #ensureMigrated() {
    if (!this.migrationPromise) {
      this.migrationPromise = this.#migrateLegacy();
    }
    await this.migrationPromise;
  }

  async #migrateLegacy() {
    const count = Number(this.db.prepare(
      "SELECT COUNT(*) AS count FROM cell_lifecycle_events WHERE cell_id = ?"
    ).get(this.cellId).count);
    if (count > 0 || !this.legacyFile) return;
    const legacy = await readJsonFile(this.legacyFile, []);
    if (!Array.isArray(legacy) || legacy.length === 0) return;
    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(`
        INSERT INTO cell_lifecycle_events (cell_id, at, event_json)
        VALUES (?, ?, ?)
      `);
      for (const event of legacy) {
        const record = structuredClone(event);
        const at = record.at ?? this.now().toISOString();
        insert.run(this.cellId, at, JSON.stringify({ ...record, at }));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function decode(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
