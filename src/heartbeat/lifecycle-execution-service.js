import { CellDivisionService } from "../lifecycle/cell-division-service.js";
import { CellFusionService } from "../lifecycle/cell-fusion-service.js";

export class LifecycleExecutionService {
  constructor({
    engine,
    divisionService = new CellDivisionService(),
    fusionService = new CellFusionService(),
  } = {}) {
    if (!engine) {
      throw new Error("LifecycleExecutionService requires engine");
    }

    this.engine = engine;
    this.divisionService = divisionService;
    this.fusionService = fusionService;
  }

  async execute(proposal) {
    const startedAt = new Date().toISOString();

    try {
      if (proposal.action === "stay") {
        return {
          status: "completed",
          action: "stay",
          startedAt,
          completedAt: new Date().toISOString(),
          result: "no-op",
        };
      }

      if (proposal.action === "repair") {
        if (proposal.repairType !== "artifact") {
          return {
            status: "blocked",
            action: "repair",
            repairType: proposal.repairType,
            startedAt,
            completedAt: new Date().toISOString(),
            reason: `${proposal.repairType} repair is not implemented`,
          };
        }

        if (!proposal.artifactId) {
          return {
            status: "blocked",
            action: "repair",
            repairType: "artifact",
            startedAt,
            completedAt: new Date().toISOString(),
            reason: "artifact repair requires artifactId",
          };
        }

        const cell = this.engine.requireCell(proposal.sourceCellId);
        const result = await cell.stabilizeArtifact({
          artifactId: proposal.artifactId,
          maxRounds: proposal.maxRounds ?? 3,
        });

        return {
          status: "completed",
          action: "repair",
          repairType: "artifact",
          startedAt,
          completedAt: new Date().toISOString(),
          result,
        };
      }

      if (proposal.action === "divide") {
        const parentCell = this.engine.requireCell(proposal.sourceCellId);
        const result = await this.divisionService.divide({
          engine: this.engine,
          parentCell,
          childId: proposal.suggestedChildId,
        });

        return {
          status: result.complete ? "completed" : "failed",
          action: "divide",
          startedAt,
          completedAt: new Date().toISOString(),
          result,
        };
      }

      if (proposal.action === "fuse") {
        const parentCells = [
          this.engine.requireCell(proposal.sourceCellId),
          ...(proposal.targetCellIds || []).map((cellId) => this.engine.requireCell(cellId)),
        ];
        const result = await this.fusionService.fuse({
          engine: this.engine,
          parentCells,
          childId: proposal.suggestedChildId,
        });

        return {
          status: result.complete ? "completed" : "failed",
          action: "fuse",
          startedAt,
          completedAt: new Date().toISOString(),
          result,
        };
      }

      return {
        status: "blocked",
        action: proposal.action,
        startedAt,
        completedAt: new Date().toISOString(),
        reason: `unsupported action: ${proposal.action}`,
      };
    } catch (error) {
      return {
        status: "failed",
        action: proposal.action,
        errorStage: "execution",
        errorMessage: error.message,
        startedAt,
        failedAt: new Date().toISOString(),
      };
    }
  }
}
