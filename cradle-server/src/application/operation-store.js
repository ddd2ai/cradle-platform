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
      lifeState: type === "stimulus-cultivation" ? "growing" : null,
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

    publishOperationUpdate(this.eventBus, updated);

    return updated;
  }

  #trim() {
    if (this.operations.size <= this.limit) return;
    for (const [operationId, operation] of this.operations) {
      if (["completed", "failed", "cancelled"].includes(operation.status)) {
        this.operations.delete(operationId);
        if (this.operations.size <= this.limit) return;
      }
    }
  }
}

export function toEventOperation(operation) {
  const { result: _result, ...summary } = operation;
  const artifacts = artifactChanges(operation);
  const attentionMessage = operation.lifeState === "needs_attention"
    ? operation.error?.message ??
      operation.result?.cells?.flatMap((cell) => cell.qualityDecision?.gates ?? [])
        .find((gate) => gate.outcome !== "sufficient")?.actual ??
      operation.result?.qualityDecision?.reason ??
      null
    : null;
  return {
    ...summary,
    ...(artifacts.length > 0
      ? { artifacts }
      : {}),
    ...(attentionMessage ? { attention: { message: attentionMessage } } : {}),
  };
}

export function artifactChanges(operation) {
  return (operation.result?.cells ?? []).flatMap((cell) => {
    const evolution = cell?.artifactEvolution;
    if (!["created", "evolved"].includes(evolution?.decision) || !evolution.artifactId) {
      return [];
    }
    return [{
      cellId: cell.cellId ?? null,
      artifactId: evolution.artifactId,
      revisionId: evolution.revisionId ?? null,
      decision: evolution.decision,
      changedPaths: evolution.changedPaths ?? [],
    }];
  });
}

export function publishOperationUpdate(eventBus, updated) {
  if (!eventBus) return;
  if (["completed", "failed", "cancelled"].includes(updated.status)) {
    eventBus.publish("cell.updated", {
      cellIds: updated.context?.cellIds ?? [],
      operationId: updated.operationId,
    });

    if (["cell-division", "cell-fusion", "cell-stabilization"].includes(updated.type)) {
      eventBus.publish("artifacts.updated", {
        cellIds: updated.context?.cellIds ?? [],
        operationId: updated.operationId,
      });
    }

    const artifacts = artifactChanges(updated);
    if (updated.type === "stimulus-cultivation" && artifacts.length > 0) {
      eventBus.publish("artifacts.updated", {
        cellIds: [...new Set(artifacts.map((artifact) => artifact.cellId).filter(Boolean))],
        artifactIds: artifacts.map((artifact) => artifact.artifactId),
        operationId: updated.operationId,
      });
    }

    if (updated.type === "heartbeat") {
      eventBus.publish("cultivation.updated", {
        operationId: updated.operationId,
      });
    }
  }
}
