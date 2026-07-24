import { ApiError } from "../api/api-error.js";

export class GetCellLifecycleDecisionUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({
    cellId,
    hasComplementaryCell = false,
    recentFailureRate = 0,
  }) {
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
      decision: await cell.getLifecycleDecision({
        hasComplementaryCell,
        recentFailureRate,
      }),
    };
  }
}
