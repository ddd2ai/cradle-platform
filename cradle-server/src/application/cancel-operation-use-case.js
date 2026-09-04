import { ApiError } from "../api/api-error.js";

export class CancelOperationUseCase {
  constructor({ operationStore, operationRunner } = {}) {
    if (!operationStore || !operationRunner) {
      throw new Error("CancelOperationUseCase requires operationStore and operationRunner");
    }
    this.operationStore = operationStore;
    this.operationRunner = operationRunner;
  }

  execute({ operationId } = {}) {
    const operation = this.operationStore.get(operationId);
    if (!operation) {
      throw new ApiError({
        status: 404,
        code: "OPERATION_NOT_FOUND",
        message: `Operation ${operationId} was not found`,
        details: { operationId },
      });
    }
    if (operation.type !== "stimulus-cultivation") {
      throw new ApiError({
        status: 409,
        code: "OPERATION_NOT_CANCELLABLE",
        message: `Operation ${operationId} does not support cancellation`,
        details: { operationId, type: operation.type },
      });
    }

    return {
      operation: this.operationRunner.cancel(operationId),
    };
  }
}
