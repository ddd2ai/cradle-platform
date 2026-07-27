import { CradleSnapshotService } from "../heartbeat/cradle-snapshot-service.js";
import { LifecycleExecutionService } from "../heartbeat/lifecycle-execution-service.js";

export class CellStabilizationService {
  constructor({
    engine,
    snapshotService = new CradleSnapshotService({ engine }),
    executionService = new LifecycleExecutionService({ engine }),
    logger = console,
  } = {}) {
    if (!engine) {
      throw new Error("CellStabilizationService requires engine");
    }

    this.engine = engine;
    this.snapshotService = snapshotService;
    this.executionService = executionService;
    this.logger = logger;
  }

  async stabilize(cell) {
    this.logger.info?.(`[stabilize] cell=${cell.id} started`);

    try {
      const snapshot = await this.snapshotService.create();
      const observation = await cell.observeCradle(snapshot);
      const proposal = await cell.proposeLifecycle({ observation, snapshot });
      const action = proposal?.action ?? "stay";
      const repairType = proposal?.repairType ?? "none";
      const artifactId = proposal?.artifactId ?? "none";

      this.logger.info?.(
        `[stabilize] cell=${cell.id} diagnosed action=${action} repairType=${repairType} artifactId=${artifactId}`
      );

      if (action !== "repair") {
        const result = {
          status: "completed",
          diagnosed: true,
          patched: false,
          verified: true,
          result: "stable",
          diagnosis: {
            action,
            reason: proposal?.reason ?? "No repair is required",
          },
        };

        this.logger.info?.(
          `[stabilize] cell=${cell.id} completed status=${result.status} patched=false verified=true`
        );

        return result;
      }

      this.logger.info?.(
        `[stabilize] cell=${cell.id} repair started repairType=${repairType} artifactId=${artifactId}`
      );

      const execution = await this.executionService.execute({
        ...proposal,
        status: "executing",
      });
      const completed = execution.status === "completed";
      const result = {
        status: completed ? "completed" : execution.status,
        diagnosed: true,
        patched: completed,
        verified: completed,
        result: completed ? "stable" : "unstable",
        diagnosis: {
          action,
          repairType: proposal.repairType ?? null,
          artifactId: proposal.artifactId ?? null,
          reason: proposal.reason ?? null,
        },
        execution,
      };

      const logMethod = completed ? "info" : "warn";
      this.logger[logMethod]?.(
        `[stabilize] cell=${cell.id} completed status=${result.status} patched=${result.patched} verified=${result.verified} repairType=${repairType} artifactId=${artifactId}`
      );

      return result;
    } catch (error) {
      this.logger.error?.(
        `[stabilize] cell=${cell.id} failed error=${error.message}`
      );
      throw error;
    }
  }
}
