export class OperationRunner {
  constructor({ operationStore }) {
    this.operationStore = operationStore;
  }

  start({ type, task }) {
    const operation = this.operationStore.create({ type });

    queueMicrotask(async () => {
      this.operationStore.update(operation.operationId, {
        status: "running",
        progress: 5,
        currentStage: "running",
        startedAt: new Date().toISOString(),
      });

      try {
        const result = await task({
          update: (patch) =>
            this.operationStore.update(operation.operationId, patch),
        });

        this.operationStore.update(operation.operationId, {
          status: "completed",
          progress: 100,
          currentStage: "completed",
          result,
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        this.operationStore.update(operation.operationId, {
          status: "failed",
          currentStage: "failed",
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
