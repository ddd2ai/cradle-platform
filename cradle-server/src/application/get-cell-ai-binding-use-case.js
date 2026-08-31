import { ApiError } from "../api/api-error.js";
import { AI_PROVIDER_OPTIONS } from "../ai/cell-ai-binding.js";

export class GetCellAiBindingUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ cellId }) {
    const cell = this.engine.getCell(cellId);
    if (!cell) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${cellId} was not found`,
        details: { cellId },
      });
    }

    return {
      cellId,
      binding: cell.getAiBinding?.() ?? {
        schemaVersion: 1,
        provider: cell.provider,
        model: cell.model,
        mode: "default",
      },
      assistantLoaded: Boolean(cell.assistant),
      options: AI_PROVIDER_OPTIONS,
    };
  }
}
