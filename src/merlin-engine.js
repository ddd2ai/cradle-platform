export class MerlinEngine {
  constructor() {
    this.cells = [];
  }

  register(cell) {
    this.cells.push(cell);
    return this;
  }

  async start() {
    for (const cell of this.cells) {
      await cell.start?.();
    }
  }

  async shutdown() {
    for (const cell of this.cells) {
      await cell.shutdown?.();
    }
  }
}