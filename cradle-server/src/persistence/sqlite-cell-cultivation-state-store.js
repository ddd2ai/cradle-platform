import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { readJsonFile } from "../utils/json-file.js";

export const SQLITE_CELL_LIFE_STATES = Object.freeze([
  "dormant",
  "stimulated",
  "growing",
  "stable",
  "cancelled",
  "needs_attention",
]);

export class SqliteCellCultivationStateStore {
  constructor({ file, cellId, legacyFile = null, now = () => new Date() } = {}) {
    if (!file || !cellId) {
      throw new Error("SqliteCellCultivationStateStore requires file and cellId");
    }
    this.file = file;
    this.cellId = cellId;
    this.legacyFile = legacyFile;
    this.now = now;
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cell_cultivation_states (
        cell_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  async read() {
    const row = this.db.prepare(
      "SELECT state_json FROM cell_cultivation_states WHERE cell_id = ?"
    ).get(this.cellId);
    if (row) return decode(row.state_json, initialState(this.cellId, this.now));

    const migrated = this.legacyFile
      ? await readJsonFile(this.legacyFile, null)
      : null;
    const state = migrated?.cellId === this.cellId
      ? normalizeState(migrated, this.cellId, this.now)
      : initialState(this.cellId, this.now);
    this.#write(state);
    return state;
  }

  async update(patch = {}) {
    const current = await this.read();
    const state = patch.state ?? current.state;
    if (!SQLITE_CELL_LIFE_STATES.includes(state)) {
      throw new Error(`Invalid Cell life state: ${state}`);
    }
    const updated = normalizeState({ ...current, ...structuredClone(patch), state }, this.cellId, this.now);
    this.#write(updated);
    return updated;
  }

  async reconcileInterrupted() {
    const current = await this.read();
    if (!["stimulated", "growing"].includes(current.state)) return current;
    return await this.update({
      state: "needs_attention",
      phase: "interrupted",
      attention: {
        code: "CULTIVATION_INTERRUPTED",
        message: "Cultivation was interrupted before a terminal evidence decision",
      },
    });
  }

  close() {
    this.db.close();
  }

  #write(state) {
    this.db.prepare(`
      INSERT INTO cell_cultivation_states (cell_id, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(cell_id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run(this.cellId, JSON.stringify(state), state.updatedAt);
  }
}

function initialState(cellId, now) {
  return {
    schemaVersion: 1,
    cellId,
    state: "dormant",
    progress: 0,
    phase: "dormant",
    operationId: null,
    stimulusId: null,
    attention: null,
    evidence: [],
    updatedAt: now().toISOString(),
  };
}

function normalizeState(state, cellId, now) {
  return {
    ...state,
    schemaVersion: 1,
    cellId,
    progress: clampProgress(state.progress),
    updatedAt: now().toISOString(),
  };
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function decode(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
