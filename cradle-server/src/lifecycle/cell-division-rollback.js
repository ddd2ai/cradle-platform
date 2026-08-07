import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export class CellDivisionRollback {
  constructor({ engine, parentCell, childId }) {
    this.engine = engine;
    this.parentCell = parentCell;
    this.childId = childId;
    this.originalActiveCellId = engine.activeCellId;
    this.transactionDir = null;
  }

  async begin() {
    if (!this.parentCell.rootDir || !this.engine.projectRoot) {
      return;
    }

    this.transactionDir = path.join(
      this.engine.projectRoot,
      ".cradle-transactions",
      `division-${crypto.randomUUID()}`
    );

    await fs.mkdir(this.transactionDir, { recursive: true });
    await fs.cp(
      this.parentCell.rootDir,
      path.join(this.transactionDir, "parent"),
      { recursive: true }
    );
  }

  async complete() {
    await this._removeTransactionFiles();
  }

  async compensate() {
    const childRootDir = this._resolveChildRootDir();

    this.engine.activeCellId = this.originalActiveCellId;
    this.engine.cells?.delete(this.childId);
    this.engine.inboxes?.delete(this.childId);
    this.engine.stagedCellIds?.delete(this.childId);

    if (childRootDir) {
      await fs.rm(childRootDir, { recursive: true, force: true });
    }

    if (this.transactionDir && this.parentCell.rootDir) {
      await fs.rm(this.parentCell.rootDir, { recursive: true, force: true });
      await fs.cp(
        path.join(this.transactionDir, "parent"),
        this.parentCell.rootDir,
        { recursive: true }
      );
    }

    await this._removeTransactionFiles();
  }

  _resolveChildRootDir() {
    const child = this.engine.cells?.get(this.childId);
    if (child?.rootDir) {
      return child.rootDir;
    }

    if (this.parentCell.cellsDir) {
      return path.join(this.parentCell.cellsDir, this.childId);
    }

    return null;
  }

  async _removeTransactionFiles() {
    if (!this.transactionDir) {
      return;
    }

    await fs.rm(this.transactionDir, { recursive: true, force: true });
  }
}
