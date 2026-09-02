const scheduleFrame = typeof requestAnimationFrame === "function"
  ? requestAnimationFrame
  : (callback) => setTimeout(callback, 16);

export class RuntimePresentationStore {
  constructor({ schedule = scheduleFrame } = {}) {
    this.schedule = schedule;
    this.listeners = new Set();
    this.pendingEvents = [];
    this.latestIndexes = new Map();
    this.flushScheduled = false;
  }

  get pendingEventCount() {
    return this.pendingEvents.length;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueue(event) {
    const key = transientEventKey(event);
    if (key && this.latestIndexes.has(key)) {
      this.pendingEvents[this.latestIndexes.get(key)] = event;
    } else {
      if (key) this.latestIndexes.set(key, this.pendingEvents.length);
      this.pendingEvents.push(event);
    }

    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.schedule(() => this.flush());
  }

  flush() {
    this.flushScheduled = false;
    const events = this.pendingEvents.splice(0);
    this.latestIndexes.clear();

    for (const listener of this.listeners) {
      listener(events);
    }
  }
}

function transientEventKey(event) {
  if (event.type === "operation.updated") {
    const operationId = event.payload?.operation?.operationId;
    return operationId ? `operation.updated:${operationId}` : null;
  }

  if (event.type === "cultivation.updated") {
    return "cultivation.updated";
  }

  if (event.type === "cell.cultivation.updated") {
    const cellId = event.payload?.cellId ?? event.payload?.cultivation?.cellId;
    return cellId ? `cell.cultivation.updated:${cellId}` : null;
  }

  return null;
}
