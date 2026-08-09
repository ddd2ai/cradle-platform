import { RuntimeEventBus } from "./runtime-event-bus.js";

export class RuntimeEventAggregator {
  constructor({ eventBus = new RuntimeEventBus(), transports = [] } = {}) {
    this.eventBus = eventBus;
    this.transports = [...transports];
    this.unsubscribe = null;
  }

  start() {
    if (this.unsubscribe) {
      return;
    }

    for (const transport of this.transports) {
      transport.start?.();
    }

    this.unsubscribe = this.eventBus.subscribe((event) => {
      for (const transport of this.transports) {
        try {
          transport.publish(event);
        } catch {
          // Delivery failure must not break the runtime publisher.
        }
      }
    });
  }

  publish(type, payload) {
    return this.eventBus.publish(type, payload);
  }

  subscribe(listener, options) {
    return this.eventBus.subscribe(listener, options);
  }

  get history() {
    return this.eventBus.history;
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;

    for (const transport of this.transports) {
      transport.stop?.();
    }
  }
}
