import { RuntimeEventClient } from "./runtime-event-client.js";

const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000];

export class WebSocketRuntimeEventClient extends RuntimeEventClient {
  constructor(url, {
    WebSocketFactory = globalThis.WebSocket,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = {}) {
    super();
    this.url = url;
    this.WebSocketFactory = WebSocketFactory;
    this.retryDelaysMs = retryDelaysMs;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.listeners = new Set();
    this.connectionListeners = new Set();
    this.socket = null;
    this.retryTimer = null;
    this.retryIndex = 0;
    this.shouldReconnect = false;
    this.hasConnected = false;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.socket || !this.WebSocketFactory) {
      return;
    }

    const socket = new this.WebSocketFactory(this.#resolveUrl());
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      const reconnected = this.hasConnected;
      this.hasConnected = true;
      this.retryIndex = 0;
      this.#emitConnection({ connected: true, reconnected });
    };

    socket.onmessage = (message) => {
      if (this.socket !== socket) return;
      try {
        this.#emit(JSON.parse(message.data));
      } catch {
        // Ignore malformed delivery without breaking the connection.
      }
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.#emitConnection({ connected: false, reconnected: false });
      this.#scheduleReconnect();
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.retryTimer) {
      this.clearTimeoutFn(this.retryTimer);
      this.retryTimer = null;
    }

    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeConnection(listener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  #resolveUrl() {
    return typeof this.url === "function" ? this.url() : this.url;
  }

  #scheduleReconnect() {
    if (!this.shouldReconnect || this.retryTimer) {
      return;
    }

    const delay = this.retryDelaysMs[
      Math.min(this.retryIndex, this.retryDelaysMs.length - 1)
    ];
    this.retryIndex += 1;
    this.retryTimer = this.setTimeoutFn(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
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
