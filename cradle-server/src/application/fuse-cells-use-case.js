import { ApiError } from "../api/api-error.js";
import { CellFusionService } from "../lifecycle/cell-fusion-service.js";
import {
  mapCellOperationError,
  requireCell,
  validateNewCellId,
} from "./cell-operation-validation.js";

export class FuseCellsUseCase {
  constructor({
    engine,
    operationGuard,
    fusionServiceFactory = () => new CellFusionService(),
  }) {
    this.engine = engine;
    this.operationGuard = operationGuard;
    this.fusionServiceFactory = fusionServiceFactory;
  }

  async execute({ parentCellIds, childCellId }) {
    if (!Array.isArray(parentCellIds) || parentCellIds.length < 2) {
      throw new ApiError({
        status: 400,
        code: "INSUFFICIENT_PARENT_CELLS",
        message: "At least two parent Cells are required",
      });
    }

    const normalizedParentIds = parentCellIds.map((cellId) =>
      String(cellId ?? "").trim()
    );

    if (
      normalizedParentIds.some((cellId) => !cellId) ||
      new Set(normalizedParentIds).size !== normalizedParentIds.length
    ) {
      throw new ApiError({
        status: 400,
        code: "DUPLICATE_PARENT_IDS",
        message: "Parent Cell IDs must be present and unique",
        details: { parentCellIds: normalizedParentIds },
      });
    }

    const parentCells = normalizedParentIds.map((cellId) =>
      requireCell(this.engine, cellId, {
        code: "PARENT_CELL_NOT_FOUND",
        label: "Parent Cell",
      })
    );
    const childId = validateNewCellId(this.engine, childCellId, {
      parentCellIds: normalizedParentIds,
    });

    return this.operationGuard.run(
      [...normalizedParentIds, childId],
      async () => {
        try {
          const result = await this.fusionServiceFactory().fuse({
            engine: this.engine,
            parentCells,
            childId,
          });

          return {
            parentCellIds: normalizedParentIds,
            childCellId: result.child?.id ?? childId,
            status: result.complete ? "completed" : result.status ?? "incomplete",
            complete: result.complete === true,
            errors: result.errors ?? [],
          };
        } catch (error) {
          throw mapCellOperationError(error, {
            code: "FUSION_VALIDATION_FAILED",
            message: "Fusion validation failed",
            details: {
              parentCellIds: normalizedParentIds,
              childCellId: childId,
            },
          });
        }
      }
    );
  }
}
