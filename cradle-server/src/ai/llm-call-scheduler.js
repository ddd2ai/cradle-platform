export class LlmCallScheduler {
  constructor({ concurrency = 3, metrics = null, now = () => Date.now() } = {}) {
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.metrics = metrics;
    this.now = now;
    this.queue = [];
    this.running = 0;
    this.metrics?.gauge("llm_concurrency_capacity", this.concurrency);
  }

  run(task, { signal = null, labels = {} } = {}) {
    if (typeof task !== "function") {
      throw new Error("LlmCallScheduler requires a task");
    }
    if (signal?.aborted) {
      return Promise.reject(abortReason(signal));
    }

    return new Promise((resolve, reject) => {
      const entry = {
        task,
        labels,
        enqueuedAt: this.now(),
        resolve,
        reject,
        signal,
        abortListener: null,
      };

      if (signal) {
        entry.abortListener = () => {
          const index = this.queue.indexOf(entry);
          if (index === -1) return;
          this.queue.splice(index, 1);
          this.metrics?.increment("llm_queue_cancelled", 1, labels);
          this.#publishDepth();
          reject(abortReason(signal));
        };
        signal.addEventListener("abort", entry.abortListener, { once: true });
      }

      this.queue.push(entry);
      this.metrics?.increment("llm_scheduler_enqueued", 1, labels);
      this.#publishDepth();
      this.#drain();
    });
  }

  get pendingCount() {
    return this.queue.length;
  }

  #drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift();
      entry.signal?.removeEventListener("abort", entry.abortListener);
      if (entry.signal?.aborted) {
        entry.reject(abortReason(entry.signal));
        continue;
      }

      this.running += 1;
      this.metrics?.observe(
        "llm_queue_wait_ms",
        Math.max(0, this.now() - entry.enqueuedAt),
        entry.labels,
      );
      this.#publishDepth();
      this.metrics?.gauge("llm_running", this.running);

      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          this.running -= 1;
          this.metrics?.gauge("llm_running", this.running);
          this.#drain();
        });
    }
  }

  #publishDepth() {
    this.metrics?.gauge("llm_queue_depth", this.queue.length);
  }
}

function abortReason(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new Error("LLM request cancelled");
}
