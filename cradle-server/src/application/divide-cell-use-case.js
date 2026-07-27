import { CellDivisionService } from "../lifecycle/cell-division-service.js";
import {
  mapCellOperationError,
  requireCell,
  validateNewCellId,
} from "./cell-operation-validation.js";

export class DivideCellUseCase {
  constructor({
    engine,
    operationGuard,
    divisionServiceFactory = () => new CellDivisionService(),
  }) {
    this.engine = engine;
    this.operationGuard = operationGuard;
    this.divisionServiceFactory = divisionServiceFactory;
  }

  async execute({ cellId, childCellId }) {
    const parentCell = requireCell(this.engine, cellId, {
      code: "SELECTED_CELL_NOT_FOUND",
      label: "Parent Cell",
    });
    const childId = validateNewCellId(this.engine, childCellId, {
      parentCellIds: [parentCell.id],
    });

    return this.operationGuard.run([parentCell.id, childId], async () => {
      try {
        const result = await this.divisionServiceFactory().divide({
          engine: this.engine,
          parentCell,
          childId,
        });

        return {
          parentCellId: parentCell.id,
          childCellId: result.child?.id ?? childId,
          status: result.complete ? "completed" : "incomplete",
          complete: result.complete === true,
          errors: result.errors ?? [],
        };
      } catch (error) {
        throw mapCellOperationError(error, {
          code: "DIVISION_FAILED",
          message: "Cell is not ready to divide",
          details: {
            parentCellId: parentCell.id,
            childCellId: childId,
          },
        });
      }
    });
  }
}
