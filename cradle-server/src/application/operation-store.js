import { randomUUID } from "crypto";

export class InMemoryOperationStore {
  constructor({ now = () => new Date(), eventStream = null } = {}) {
    this.now = now;
    this.eventStream = eventStream;
    this.operations = new Map();
  }

  create({ type, context = {} }) {
    const operation = {
      operationId: `op-${randomUUID()}`,
      type,
      context,
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
    this.eventStream?.publish("operation.updated", { operation });

    return operation;
  }

  get(operationId) {
    return this.operations.get(operationId) ?? null;
  }

  list() {
    return [...this.operations.values()].sort(
      (a, b) => String(b.createdAt).localeCompare(String(a.createdAt))
    );
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
    this.eventStream?.publish("operation.updated", { operation: updated });

    if (["completed", "failed"].includes(updated.status)) {
      this.eventStream?.publish("cell.updated", {
        cellIds: updated.context?.cellIds ?? [],
        operationId: updated.operationId,
      });

      if (["cell-division", "cell-fusion", "cell-stabilization"].includes(updated.type)) {
        this.eventStream?.publish("artifacts.updated", {
          cellIds: updated.context?.cellIds ?? [],
          operationId: updated.operationId,
        });
      }

      if (updated.type === "heartbeat") {
        this.eventStream?.publish("cultivation.updated", {
          operationId: updated.operationId,
        });
      }
    }

    return updated;
  }
}
