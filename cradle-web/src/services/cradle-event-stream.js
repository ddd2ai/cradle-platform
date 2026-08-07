const EVENT_TYPES = [
  "log.appended",
  "logs.cleared",
  "operation.updated",
  "cell.created",
  "cell.updated",
  "artifacts.updated",
  "cultivation.updated",
];

let eventSource = null;
const subscribers = new Set();

export function subscribeToCradleEvents(listener) {
  subscribers.add(listener);
  ensureEventSource();

  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      eventSource?.close();
      eventSource = null;
    }
  };
}

function ensureEventSource() {
  if (eventSource || typeof EventSource === "undefined") {
    return;
  }

  eventSource = new EventSource("/api/v1/events");

  for (const type of EVENT_TYPES) {
    eventSource.addEventListener(type, (message) => {
      let data;

      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }

      for (const subscriber of subscribers) {
        subscriber({ type, data });
      }
    });
  }
}
