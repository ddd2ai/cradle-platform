import { ApiError } from "../api/api-error.js";

export class CellOperationGuard {
  constructor() {
    this.activeKeys = new Set();
  }

  async run(keys, operation) {
    const normalizedKeys = [...new Set(keys.filter(Boolean))];
    const busyKey = normalizedKeys.find((key) => this.activeKeys.has(key));

    if (busyKey) {
      throw new ApiError({
        status: 409,
        code: "OPERATION_ALREADY_RUNNING",
        message: `An operation is already running for Cell ${busyKey}`,
        details: { cellId: busyKey },
      });
    }

    normalizedKeys.forEach((key) => this.activeKeys.add(key));

    try {
      return await operation();
    } finally {
      normalizedKeys.forEach((key) => this.activeKeys.delete(key));
    }
  }
}
