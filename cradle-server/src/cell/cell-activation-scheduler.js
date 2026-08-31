export class CellActivationScheduler {
  constructor({ concurrency = 4, metrics = null } = {}) {
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.queue = new Map();
    this.running = 0;
    this.metrics = metrics;
    this.metrics?.gauge("activation_concurrency_capacity", this.concurrency);
  }

  enqueue(cellId, job) {
    if (this.queue.has(cellId)) return false;
    this.queue.set(cellId, job);
    this.metrics?.increment("activation_enqueued", 1, { cellId });
    this.metrics?.gauge("activation_queue_depth", this.queue.size);
    this.#drain();
    return true;
  }

  cancel(cellId) {
    const deleted = this.queue.delete(cellId);
    this.metrics?.gauge("activation_queue_depth", this.queue.size);
    return deleted;
  }

  get pendingCount() {
    return this.queue.size;
  }

  #drain() {
    while (this.running < this.concurrency && this.queue.size > 0) {
      const [cellId, job] = this.queue.entries().next().value;
      this.queue.delete(cellId);
      this.running += 1;
      this.metrics?.gauge("activation_queue_depth", this.queue.size);
      this.metrics?.gauge("activation_running", this.running);

      Promise.resolve()
        .then(job)
        .catch(() => {
          // The Cell lifecycle owns error state and retry policy.
        })
        .finally(() => {
          this.running -= 1;
          this.metrics?.gauge("activation_running", this.running);
          this.#drain();
        });
    }
  }
}
