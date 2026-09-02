export class OperationRunner {
  constructor({ operationStore }) {
    this.operationStore = operationStore;
  }

  start({ type, context, task }) {
    const operation = this.operationStore.create({ type, context });

    queueMicrotask(async () => {
      this.operationStore.update(operation.operationId, {
        status: "running",
        progress: 5,
        currentStage: "running",
        ...(operation.type === "stimulus-cultivation" ? { lifeState: "growing" } : {}),
        startedAt: new Date().toISOString(),
      });

      try {
        const result = await task({
          operationId: operation.operationId,
          update: (patch) =>
            this.operationStore.update(operation.operationId, patch),
        });

        this.operationStore.update(operation.operationId, {
          status: "completed",
          progress: 100,
          currentStage: result?.currentStage ?? "completed",
          ...(operation.type === "stimulus-cultivation" || result?.lifeState
            ? { lifeState: result?.lifeState ?? "stable" }
            : {}),
          result,
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        this.operationStore.update(operation.operationId, {
          status: "failed",
          currentStage: "failed",
          ...(operation.type === "stimulus-cultivation"
            ? { lifeState: "needs_attention" }
            : {}),
          error: {
            code: "OPERATION_FAILED",
            message: error?.message || "Operation failed",
          },
          failedAt: new Date().toISOString(),
        });
      }
    });

    return operation;
  }
}
