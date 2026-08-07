const DEFAULT_HISTORY_LIMIT = 500;

export class ApplicationEventStream {
  constructor({ historyLimit = DEFAULT_HISTORY_LIMIT, now = () => new Date() } = {}) {
    this.historyLimit = historyLimit;
    this.now = now;
    this.nextId = 1;
    this.history = [];
    this.subscribers = new Set();
  }

  publish(type, data) {
    if (!type) {
      throw new Error("Application event type is required");
    }

    const event = {
      id: String(this.nextId),
      type,
      data,
      occurredAt: this.now().toISOString(),
    };

    this.nextId += 1;
    this.history.push(event);

    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    for (const subscriber of this.subscribers) {
      notifySubscriber(subscriber, event);
    }

    return event;
  }

  subscribe(listener, { afterEventId } = {}) {
    const lastSeenId = Number(afterEventId);

    if (Number.isFinite(lastSeenId)) {
      for (const event of this.history) {
        if (Number(event.id) > lastSeenId) {
          notifySubscriber(listener, event);
        }
      }
    }

    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }
}

function notifySubscriber(listener, event) {
  try {
    listener(event);
  } catch {
    // Event delivery must not fail the domain operation that published it.
  }
}

export function createApplicationEventResponse({ eventStream, lastEventId }) {
  return {
    streamResponse: true,
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
    subscribe(write) {
      write(": connected\n\n");
      return eventStream.subscribe(
        (event) => write(formatServerSentEvent(event)),
        { afterEventId: lastEventId }
      );
    },
  };
}

export function formatServerSentEvent(event) {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify({ ...event.data, occurredAt: event.occurredAt })}`,
    "",
    "",
  ].join("\n");
}
