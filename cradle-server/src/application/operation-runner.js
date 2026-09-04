import { abortReason } from "../utils/abort.js";

export class OperationRunner {
  constructor({ operationStore }) {
    this.operationStore = operationStore;
    this.controllers = new Map();
  }

  start({ type, context, task }) {
    const operation = this.operationStore.create({ type, context });
    const controller = new AbortController();
    this.controllers.set(operation.operationId, controller);

    queueMicrotask(async () => {
      if (controller.signal.aborted) {
        this.#finishCancelled(operation, controller.signal);
        this.controllers.delete(operation.operationId);
        return;
      }
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
          signal: controller.signal,
          update: (patch) => {
            const current = this.operationStore.get(operation.operationId);
            if (current?.status === "cancelling") return current;
            return this.operationStore.update(operation.operationId, patch);
          },
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
        if (controller.signal.aborted) {
          this.#finishCancelled(operation, controller.signal);
          return;
        }
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
      } finally {
        this.controllers.delete(operation.operationId);
      }
    });

    return operation;
  }

  cancel(operationId, { reason = "Cancelled by user" } = {}) {
    const operation = this.operationStore.get(operationId);
    if (!operation) return null;
    if (["completed", "failed", "cancelled"].includes(operation.status)) return operation;
    if (operation.status === "cancelling") return operation;

    const cancellation = new Error(reason);
    cancellation.code = "OPERATION_CANCELLED";
    this.controllers.get(operationId)?.abort(cancellation);
    return this.operationStore.update(operationId, {
      status: "cancelling",
      currentStage: "cancelling",
      cancellation: {
        reason,
        requestedAt: new Date().toISOString(),
      },
    });
  }

  #finishCancelled(operation, signal) {
    const current = this.operationStore.get(operation.operationId);
    if (["completed", "failed", "cancelled"].includes(current?.status)) return current;
    const reason = abortReason(signal).message;
    return this.operationStore.update(operation.operationId, {
      status: "cancelled",
      currentStage: "cancelled",
      ...(operation.type === "stimulus-cultivation" ? { lifeState: "cancelled" } : {}),
      error: null,
      cancellation: {
        reason,
        requestedAt: current?.cancellation?.requestedAt ?? new Date().toISOString(),
      },
      cancelledAt: new Date().toISOString(),
    });
  }
}
