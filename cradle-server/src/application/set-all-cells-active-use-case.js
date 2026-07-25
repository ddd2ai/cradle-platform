import { toCellSummary } from "./cell-dto.js";

export class SetAllCellsActiveUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ active }) {
    if (active) {
      await this.engine.activateAllCells();
    } else {
      await this.engine.deactivateAllCells({ waitForTicks: true });
    }

    const cells = await Promise.all(
      this.engine.listCells().map((cell) => toCellSummary(cell))
    );

    return {
      cells,
      cultivation: this.engine.getCultivationStatus?.() ?? null,
    };
  }
}
