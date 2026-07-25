import { toCellSummary } from "./cell-dto.js";

export class GetColonyUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute() {
    const cells = await Promise.all(
      this.engine.listCells().map((cell) => toCellSummary(cell))
    );

    return {
      activeCellId: this.engine.activeCellId,
      cellCount: cells.length,
      activeCount: cells.filter((cell) => cell.active).length,
      idleCount: cells.filter((cell) => !cell.active).length,
      cells,
    };
  }
}
