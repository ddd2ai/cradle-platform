import { RuntimeEventTransport } from "./runtime-event-transport.js";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

export function formatServerSentEvent(event) {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    "",
    "",
  ].join("\n");
}

export class SseRuntimeEventTransport extends RuntimeEventTransport {
  constructor({
    eventHistory = () => [],
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {}) {
    super();
    this.eventHistory = eventHistory;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.clients = new Set();
    this.heartbeatTimer = null;
  }

  start() {
    if (this.heartbeatTimer || this.heartbeatIntervalMs <= 0) {
      return;
    }

    this.heartbeatTimer = this.setIntervalFn(() => {
      this.#writeToClients(": keep-alive\n\n");
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  addClient(response, { afterEventId } = {}) {
    this.start();
    this.clients.add(response);
    response.write(": connected\n\n");

    const lastSeenId = Number(afterEventId);
    if (Number.isFinite(lastSeenId)) {
      for (const event of this.eventHistory()) {
        if (Number(event.id) > lastSeenId) {
          response.write(formatServerSentEvent(event));
        }
      }
    }

    const remove = () => {
      this.clients.delete(response);
    };
    response.on?.("close", remove);
    response.on?.("error", remove);
    return remove;
  }

  publish(event) {
    this.#writeToClients(formatServerSentEvent(event));
  }

  stop() {
    if (this.heartbeatTimer) {
      this.clearIntervalFn(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const client of this.clients) {
      client.end?.();
    }
    this.clients.clear();
  }

  #writeToClients(payload) {
    for (const client of [...this.clients]) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
        client.end?.();
      }
    }
  }
}
