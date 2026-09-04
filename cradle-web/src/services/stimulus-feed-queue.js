const DEFAULT_CONCURRENCY = 2;

export class StimulusFeedQueue {
  constructor({
    upload,
    concurrency = DEFAULT_CONCURRENCY,
    now = () => new Date(),
    idFactory = defaultIdFactory,
    schedule = (task) => queueMicrotask(task),
  } = {}) {
    if (typeof upload !== "function") {
      throw new Error("StimulusFeedQueue requires an upload function");
    }

    this.upload = upload;
    this.concurrency = Math.max(1, Math.floor(Number(concurrency) || DEFAULT_CONCURRENCY));
    this.now = now;
    this.idFactory = idFactory;
    this.schedule = schedule;
    this.entries = new Map();
    this.pending = [];
    this.running = 0;
    this.listeners = new Set();
    this.idleWaiters = new Set();
    this.pumpScheduled = false;
  }

  enqueue(fileList, { artifactType = null } = {}) {
    const files = Array.from(fileList ?? []).filter(Boolean);
    const created = files.map((file) => {
      const feedId = this.idFactory();
      const entry = {
        feedId,
        file,
        sourceName: file.name || "stimulus.bin",
        mediaType: file.type || "application/octet-stream",
        size: Number(file.size) || 0,
        artifactType: artifactType || null,
        state: "queued",
        operation: null,
        error: null,
        enqueuedAt: this.now().toISOString(),
        startedAt: null,
        acceptedAt: null,
      };
      this.entries.set(feedId, entry);
      this.pending.push(feedId);
      return toPublicEntry(entry, this.pending);
    });

    if (created.length > 0) {
      this.#publish();
      this.#schedulePump();
    }
    return created;
  }

  adoptOperations(operations) {
    let changed = false;
    for (const operation of operations ?? []) {
      if (!operation?.operationId || this.#findByOperationId(operation.operationId)) continue;
      const feedId = `operation:${operation.operationId}`;
      this.entries.set(feedId, {
        feedId,
        file: null,
        sourceName: operation.context?.sourceName ?? operation.source?.originalName ?? "Stimulus",
        mediaType: operation.context?.sourceMediaType ?? null,
        size: 0,
        artifactType: operation.context?.artifactType ?? null,
        state: "accepted",
        operation,
        error: null,
        enqueuedAt: operation.createdAt ?? this.now().toISOString(),
        startedAt: operation.startedAt ?? null,
        acceptedAt: operation.createdAt ?? this.now().toISOString(),
      });
      changed = true;
    }
    if (changed) this.#publish();
  }

  retry(feedId) {
    const entry = this.entries.get(feedId);
    if (!entry || entry.state !== "failed" || !entry.file) return false;
    entry.state = "queued";
    entry.error = null;
    entry.startedAt = null;
    entry.acceptedAt = null;
    this.pending.push(feedId);
    this.#publish();
    this.#schedulePump();
    return true;
  }

  dismiss(feedId) {
    const entry = this.entries.get(feedId);
    if (!entry || entry.state === "uploading") return false;
    const pendingIndex = this.pending.indexOf(feedId);
    if (pendingIndex >= 0) this.pending.splice(pendingIndex, 1);
    this.entries.delete(feedId);
    this.#publish();
    this.#resolveIdle();
    return true;
  }

  list() {
    return [...this.entries.values()]
      .reverse()
      .map((entry) => toPublicEntry(entry, this.pending));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.list());
    return () => this.listeners.delete(listener);
  }

  whenIdle() {
    if (this.running === 0 && this.pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }

  #schedulePump() {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    this.schedule(() => {
      this.pumpScheduled = false;
      this.#pump();
    });
  }

  #pump() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const feedId = this.pending.shift();
      const entry = this.entries.get(feedId);
      if (!entry || entry.state !== "queued") continue;
      this.#start(entry);
    }
    this.#resolveIdle();
  }

  async #start(entry) {
    this.running += 1;
    entry.state = "uploading";
    entry.startedAt = this.now().toISOString();
    this.#publish();

    try {
      const operation = await this.upload(entry.file, {
        artifactType: entry.artifactType,
      });
      entry.state = "accepted";
      entry.operation = operation;
      entry.acceptedAt = this.now().toISOString();
      entry.sourceName = operation?.context?.sourceName ?? entry.sourceName;
      // Once REST has accepted the source, the server owns it. Releasing the
      // browser Blob avoids retaining large file payloads during a long LLM run.
      entry.file = null;
    } catch (error) {
      entry.state = "failed";
      entry.error = error?.message || "Upload failed";
    } finally {
      this.running -= 1;
      this.#publish();
      this.#pump();
    }
  }

  #findByOperationId(operationId) {
    return [...this.entries.values()].find(
      (entry) => entry.operation?.operationId === operationId,
    );
  }

  #publish() {
    const snapshot = this.list();
    for (const listener of this.listeners) listener(snapshot);
  }

  #resolveIdle() {
    if (this.running > 0 || this.pending.length > 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }
}

function toPublicEntry(entry, pending) {
  const queueIndex = entry.state === "queued" ? pending.indexOf(entry.feedId) : -1;
  return {
    feedId: entry.feedId,
    sourceName: entry.sourceName,
    mediaType: entry.mediaType,
    size: entry.size,
    artifactType: entry.artifactType,
    state: entry.state,
    operation: entry.operation,
    error: entry.error,
    enqueuedAt: entry.enqueuedAt,
    startedAt: entry.startedAt,
    acceptedAt: entry.acceptedAt,
    queuePosition: queueIndex >= 0 ? queueIndex + 1 : null,
  };
}

let nextLocalId = 0;
function defaultIdFactory() {
  nextLocalId += 1;
  return `feed-${Date.now().toString(36)}-${nextLocalId.toString(36)}`;
}
