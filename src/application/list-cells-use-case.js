import { toCellSummary } from "./cell-dto.js";

export class ListCellsUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute() {
    const cells = await Promise.all(
      this.engine.listCells().map((cell) => toCellSummary(cell))
    );

    return { cells };
  }
}
