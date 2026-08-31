import { randomUUID } from "crypto";

export class InMemoryOperationStore {
  constructor({ now = () => new Date(), eventStream = null, eventBus = null, limit = 500 } = {}) {
    this.now = now;
    // 接受 eventBus (新) 或 eventStream (舊) — 兩者 API 相同
    this.eventBus = eventBus ?? eventStream;
    this.operations = new Map();
    this.limit = limit;
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
    this.#trim();
    this.eventBus?.publish("operation.updated", { operation: toEventOperation(operation) });

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
    this.#trim();
    this.eventBus?.publish("operation.updated", { operation: toEventOperation(updated) });

    if (["completed", "failed"].includes(updated.status)) {
      this.eventBus?.publish("cell.updated", {
        cellIds: updated.context?.cellIds ?? [],
        operationId: updated.operationId,
      });

      if (["cell-division", "cell-fusion", "cell-stabilization"].includes(updated.type)) {
        this.eventBus?.publish("artifacts.updated", {
          cellIds: updated.context?.cellIds ?? [],
          operationId: updated.operationId,
        });
      }

      if (updated.type === "heartbeat") {
        this.eventBus?.publish("cultivation.updated", {
          operationId: updated.operationId,
        });
      }
    }

    return updated;
  }

  #trim() {
    if (this.operations.size <= this.limit) return;
    for (const [operationId, operation] of this.operations) {
      if (["completed", "failed"].includes(operation.status)) {
        this.operations.delete(operationId);
        if (this.operations.size <= this.limit) return;
      }
    }
  }
}

function toEventOperation(operation) {
  const { result: _result, ...summary } = operation;
  return summary;
}
