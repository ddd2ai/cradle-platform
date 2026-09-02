import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export const CELL_LIFE_STATES = Object.freeze([
  "dormant",
  "stimulated",
  "growing",
  "stable",
  "needs_attention",
]);

export class CellCultivationStateStore {
  constructor({ file, cellId, now = () => new Date() } = {}) {
    if (!file || !cellId) throw new Error("CellCultivationStateStore requires file and cellId");
    this.file = file;
    this.cellId = cellId;
    this.now = now;
  }

  async read() {
    return await readJsonFile(this.file, initialState(this.cellId, this.now));
  }

  async update(patch = {}) {
    const current = await this.read();
    const state = patch.state ?? current.state;
    if (!CELL_LIFE_STATES.includes(state)) throw new Error(`Invalid Cell life state: ${state}`);
    const updated = {
      ...current,
      ...structuredClone(patch),
      schemaVersion: 1,
      cellId: this.cellId,
      progress: clampProgress(patch.progress ?? current.progress),
      updatedAt: this.now().toISOString(),
    };
    await writeJsonFile(this.file, updated);
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

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
