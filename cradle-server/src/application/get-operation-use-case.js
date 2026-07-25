import { ApiError } from "../api/api-error.js";

export class GetOperationUseCase {
  constructor({ operationStore }) {
    this.operationStore = operationStore;
  }

  async execute({ operationId }) {
    const operation = this.operationStore.get(operationId);

    if (!operation) {
      throw new ApiError({
        status: 404,
        code: "OPERATION_NOT_FOUND",
        message: `Operation ${operationId} was not found`,
        details: { operationId },
      });
    }

    return { operation };
  }
}
