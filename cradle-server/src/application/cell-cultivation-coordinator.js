import { abortReason, throwIfAborted } from "../utils/abort.js";

export class CellCultivationCoordinator {
  constructor() {
    this.tails = new Map();
  }

  async run(cellId, task, { signal = null } = {}) {
    if (!cellId || typeof task !== "function") {
      throw new Error("CellCultivationCoordinator requires cellId and task");
    }

    const previous = this.tails.get(cellId) ?? Promise.resolve();
    let started = false;
    const current = previous.catch(() => {}).then(() => {
      throwIfAborted(signal);
      started = true;
      return task();
    });
    this.tails.set(cellId, current);
    const cleanup = () => {
      if (this.tails.get(cellId) === current) this.tails.delete(cellId);
    };
    current.then(cleanup, cleanup);

    // A queued caller can finish cancellation immediately. Once mutation has
    // started, wait for the task's cancellation compensation before returning.
    return await waitForCoordinatedResult(current, signal, () => started);
  }

  isBusy(cellId) {
    return this.tails.has(cellId);
  }
}

function waitForCoordinatedResult(current, signal, hasStarted) {
  if (!signal) return current;
  if (signal.aborted && !hasStarted()) return Promise.reject(abortReason(signal));

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      if (!hasStarted()) reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort);
    if (signal.aborted) onAbort();
    current.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}
