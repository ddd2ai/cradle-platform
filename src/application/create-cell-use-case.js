import { ApiError } from "../api/api-error.js";
import { toCellDetail } from "./cell-dto.js";

export class CreateCellUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ cellId }) {
    const normalizedCellId = String(cellId ?? "").trim();

    if (!normalizedCellId) {
      throw new ApiError({
        status: 400,
        code: "INVALID_CELL_ID",
        message: "cellId is required",
      });
    }

    if (normalizedCellId === this.engine.CRADLE_ID) {
      throw new ApiError({
        status: 400,
        code: "RESERVED_CELL_ID",
        message: `${this.engine.CRADLE_ID} is reserved for engine mode`,
        details: { cellId: normalizedCellId },
      });
    }

    if (this.engine.hasCell(normalizedCellId)) {
      throw new ApiError({
        status: 409,
        code: "CELL_ALREADY_EXISTS",
        message: `Cell ${normalizedCellId} already exists`,
        details: { cellId: normalizedCellId },
      });
    }

    const cell = await this.engine.createCell(normalizedCellId);

    return { cell: await toCellDetail(cell) };
  }
}
