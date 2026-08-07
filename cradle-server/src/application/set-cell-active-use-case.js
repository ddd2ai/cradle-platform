import { ApiError } from "../api/api-error.js";
import { toCellDetail } from "./cell-dto.js";

export class SetCellActiveUseCase {
  constructor({ engine, eventStream = null }) {
    this.engine = engine;
    this.eventStream = eventStream;
  }

  async execute({ cellId, active }) {
    const cell = this.engine.getCell(cellId);

    if (!cell) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${cellId} was not found`,
        details: { cellId },
      });
    }

    if (active) {
      await this.engine.activateCell(cellId);
    } else {
      await this.engine.deactivateCell(cellId);
    }

    const detail = await toCellDetail(cell);
    this.eventStream?.publish("cell.updated", { cell: detail });
    return { cell: detail };
  }
}
