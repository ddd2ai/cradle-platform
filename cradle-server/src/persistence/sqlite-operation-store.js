import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  publishOperationUpdate,
  toEventOperation,
} from "../application/operation-store.js";

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

/**
 * Durable operation store port backed by SQLite.
 *
 * Operation payloads stay JSON-shaped at the application boundary; SQLite
 * stores indexed lifecycle fields as columns and opaque context/result values
 * as JSON. The adapter is intentionally provider- and Cell-domain-neutral.
 */
export class SqliteOperationStore {
  constructor({ file, now = () => new Date(), eventStream = null, eventBus = null, limit = 500 } = {}) {
    if (!file) throw new Error("SqliteOperationStore requires file");
    this.file = file;
    this.now = now;
    this.eventBus = eventBus ?? eventStream;
    this.limit = limit;
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS operations (
        operation_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        context_json TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL,
        current_stage TEXT NOT NULL,
        life_state TEXT,
        result_json TEXT,
        error_json TEXT,
        cancellation_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        cancelled_at TEXT
      );
      CREATE INDEX IF NOT EXISTS operations_created_at_idx
        ON operations(created_at DESC);
      CREATE INDEX IF NOT EXISTS operations_status_idx
        ON operations(status);
    `);
  }

  create({ type, context = {} }) {
    const now = this.now().toISOString();
    const operation = {
      operationId: `op-${randomUUID()}`,
      type,
      context,
      status: "accepted",
      progress: 0,
      currentStage: "accepted",
      lifeState: type === "stimulus-cultivation" ? "growing" : null,
      result: null,
      error: null,
      cancellation: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
    };
    this.db.prepare(`
      INSERT INTO operations (
        operation_id, type, context_json, status, progress, current_stage,
        life_state, result_json, error_json, cancellation_json,
        created_at, updated_at, started_at, completed_at, failed_at, cancelled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      operation.operationId,
      operation.type,
      encode(operation.context),
      operation.status,
      operation.progress,
      operation.currentStage,
      operation.lifeState,
      encode(operation.result),
      encode(operation.error),
      encode(operation.cancellation),
      operation.createdAt,
      operation.updatedAt,
      operation.startedAt,
      operation.completedAt,
      operation.failedAt,
      operation.cancelledAt,
    );
    this.#trim();
    this.eventBus?.publish("operation.updated", { operation: toEventOperation(operation) });
    return operation;
  }

  get(operationId) {
    const row = this.db.prepare("SELECT * FROM operations WHERE operation_id = ?").get(operationId);
    return row ? decodeRow(row) : null;
  }

  list() {
    return this.db.prepare("SELECT * FROM operations ORDER BY created_at DESC").all().map(decodeRow);
  }

  update(operationId, patch) {
    const operation = this.get(operationId);
    if (!operation) return null;
    const updated = { ...operation, ...structuredClone(patch), updatedAt: this.now().toISOString() };
    this.db.prepare(`
      UPDATE operations SET
        type = ?, context_json = ?, status = ?, progress = ?, current_stage = ?,
        life_state = ?, result_json = ?, error_json = ?, cancellation_json = ?,
        updated_at = ?, started_at = ?, completed_at = ?, failed_at = ?, cancelled_at = ?
      WHERE operation_id = ?
    `).run(
      updated.type,
      encode(updated.context),
      updated.status,
      updated.progress,
      updated.currentStage,
      updated.lifeState,
      encode(updated.result),
      encode(updated.error),
      encode(updated.cancellation),
      updated.updatedAt,
      updated.startedAt,
      updated.completedAt,
      updated.failedAt,
      updated.cancelledAt,
      updated.operationId,
    );
    this.#trim();
    this.eventBus?.publish("operation.updated", { operation: toEventOperation(updated) });
    publishOperationUpdate(this.eventBus, updated);
    return updated;
  }

  reconcileInterrupted() {
    const interrupted = this.db.prepare(
      "SELECT operation_id FROM operations WHERE status IN ('accepted', 'running', 'cancelling')"
    ).all();
    for (const row of interrupted) {
      this.update(row.operation_id, {
        status: "failed",
        currentStage: "failed",
        error: {
          code: "OPERATION_INTERRUPTED",
          message: "Operation was interrupted when the Cradle server stopped",
        },
        failedAt: this.now().toISOString(),
        ...(this.get(row.operation_id)?.type === "stimulus-cultivation"
          ? { lifeState: "needs_attention" }
          : {}),
      });
    }
    return interrupted.length;
  }

  close() {
    this.db.close();
  }

  #trim() {
    const count = Number(this.db.prepare("SELECT COUNT(*) AS count FROM operations").get().count);
    const excess = count - this.limit;
    if (excess <= 0) return;
    this.db.prepare(`
      DELETE FROM operations WHERE operation_id IN (
        SELECT operation_id FROM operations
        WHERE status IN ('completed', 'failed', 'cancelled')
        ORDER BY created_at ASC LIMIT ?
      )
    `).run(excess);
  }
}

function decodeRow(row) {
  return {
    operationId: row.operation_id,
    type: row.type,
    context: decode(row.context_json, {}),
    status: row.status,
    progress: row.progress,
    currentStage: row.current_stage,
    lifeState: row.life_state,
    result: decode(row.result_json, null),
    error: decode(row.error_json, null),
    cancellation: decode(row.cancellation_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    cancelledAt: row.cancelled_at,
  };
}

function encode(value) {
  return JSON.stringify(value ?? null);
}

function decode(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
