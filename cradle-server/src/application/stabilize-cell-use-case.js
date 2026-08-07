import { ApiError } from "../api/api-error.js";
import { CellStabilizationService } from "./cell-stabilization-service.js";
import {
  mapCellOperationError,
  requireCell,
} from "./cell-operation-validation.js";

export class StabilizeCellUseCase {
  constructor({
    engine,
    operationGuard,
    stabilizationServiceFactory =
      () => new CellStabilizationService({ engine }),
  }) {
    this.engine = engine;
    this.operationGuard = operationGuard;
    this.stabilizationServiceFactory = stabilizationServiceFactory;
  }

  prepare({ cellId }) {
    return {
      cell: requireCell(this.engine, cellId, {
        code: "SELECTED_CELL_NOT_FOUND",
        label: "Selected Cell",
      }),
    };
  }

  async execute({ cellId, prepared, onProgress = () => {} }) {
    const { cell } = prepared ?? this.prepare({ cellId });

    onProgress({
      progress: 15,
      currentStage: "stabilizing",
    });

    return this.operationGuard.run([cell.id], async () => {
      try {
        const result = await this.stabilizationServiceFactory().stabilize(cell);

        if (result.status !== "completed" || !result.verified) {
          throw new ApiError({
            status: 422,
            code: "STABILIZATION_FAILED",
            message:
              result.execution?.reason ??
              result.execution?.errorMessage ??
              "Stabilization failed",
            details: {
              cellId: cell.id,
              result,
            },
          });
        }

        onProgress({
          progress: 90,
          currentStage: "verifying",
        });

        return {
          cellId: cell.id,
          ...result,
        };
      } catch (error) {
        throw mapCellOperationError(error, {
          code: "STABILIZATION_FAILED",
          message: "Stabilization failed",
          details: { cellId: cell.id },
        });
      }
    });
  }
}
