import { RuntimeEventClient } from "./runtime-event-client.js";

export const RUNTIME_EVENT_TYPES = [
  "log.appended",
  "logs.cleared",
  "operation.updated",
  "cell.created",
  "cell.updated",
  "artifacts.updated",
  "cultivation.updated",
];

export class SseRuntimeEventClient extends RuntimeEventClient {
  constructor(url, { EventSourceFactory = globalThis.EventSource } = {}) {
    super();
    this.url = url;
    this.EventSourceFactory = EventSourceFactory;
    this.listeners = new Set();
    this.connectionListeners = new Set();
    this.eventSource = null;
    this.hasConnected = false;
  }

  connect() {
    if (this.eventSource || !this.EventSourceFactory) {
      return;
    }

    const source = new this.EventSourceFactory(this.url);
    this.eventSource = source;
    source.onopen = () => {
      this.#emitConnection({ connected: true, reconnected: this.hasConnected });
      this.hasConnected = true;
    };
    source.onerror = () => this.#emitConnection({ connected: false, reconnected: false });

    for (const type of RUNTIME_EVENT_TYPES) {
      source.addEventListener(type, (message) => {
        try {
          this.#emit(JSON.parse(message.data));
        } catch {
          // Ignore malformed delivery without breaking the stream.
        }
      });
    }
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeConnection(listener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  #emit(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  #emitConnection(state) {
    for (const listener of this.connectionListeners) {
      listener(state);
    }
  }
}
