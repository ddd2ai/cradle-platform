import WebSocket from "ws";
import { RuntimeEventTransport } from "./runtime-event-transport.js";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export class WebSocketRuntimeEventTransport extends RuntimeEventTransport {
  constructor({
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {}) {
    super();
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.clients = new Set();
    this.heartbeatTimer = null;
  }

  get clientCount() {
    return this.clients.size;
  }

  start() {
    if (this.heartbeatTimer || this.heartbeatIntervalMs <= 0) {
      return;
    }

    this.heartbeatTimer = this.setIntervalFn(
      () => this.#checkConnections(),
      this.heartbeatIntervalMs,
    );
    this.heartbeatTimer.unref?.();
  }

  addClient(socket) {
    this.start();
    socket.isAlive = true;
    this.clients.add(socket);

    const remove = () => this.clients.delete(socket);
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.on("close", remove);
    socket.on("error", remove);
    return remove;
  }

  publish(event) {
    const payload = JSON.stringify(event);

    for (const client of [...this.clients]) {
      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      try {
        client.send(payload);
      } catch {
        this.clients.delete(client);
        client.terminate?.();
      }
    }
  }

  stop() {
    if (this.heartbeatTimer) {
      this.clearIntervalFn(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients) {
      client.close?.(1001, "Server shutting down");
    }
    this.clients.clear();
  }

  #checkConnections() {
    for (const client of [...this.clients]) {
      if (client.isAlive === false) {
        this.clients.delete(client);
        client.terminate?.();
        continue;
      }

      if (client.readyState !== WebSocket.OPEN) {
        continue;
      }

      client.isAlive = false;
      client.ping();
    }
  }
}
