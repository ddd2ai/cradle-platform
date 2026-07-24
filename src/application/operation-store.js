import { randomUUID } from "crypto";

export class InMemoryOperationStore {
  constructor({ now = () => new Date() } = {}) {
    this.now = now;
    this.operations = new Map();
  }

  create({ type }) {
    const operation = {
      operationId: `op-${randomUUID()}`,
      type,
      status: "accepted",
      progress: 0,
      currentStage: "accepted",
      result: null,
      error: null,
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
    };

    this.operations.set(operation.operationId, operation);

    return operation;
  }

  get(operationId) {
    return this.operations.get(operationId) ?? null;
  }

  update(operationId, patch) {
    const operation = this.get(operationId);

    if (!operation) {
      return null;
    }

    const updated = {
      ...operation,
      ...patch,
      updatedAt: this.now().toISOString(),
    };

    this.operations.set(operationId, updated);

    return updated;
  }
}
