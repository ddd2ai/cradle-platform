export class CellCultivationCoordinator {
  constructor() {
    this.tails = new Map();
  }

  async run(cellId, task) {
    if (!cellId || typeof task !== "function") {
      throw new Error("CellCultivationCoordinator requires cellId and task");
    }

    const previous = this.tails.get(cellId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    this.tails.set(cellId, current);

    try {
      return await current;
    } finally {
      if (this.tails.get(cellId) === current) this.tails.delete(cellId);
    }
  }

  isBusy(cellId) {
    return this.tails.has(cellId);
  }
}
