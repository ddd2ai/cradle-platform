import { updateOperationProgress } from "./operation-progress.js";

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

      // Operation progress 使用 throttling
      if (type === "operation.updated" && data.operation) {
        updateOperationProgress(data.operation);
      }

      // 仍然發送給所有 subscribers (向後相容)
      for (const subscriber of subscribers) {
        subscriber({ type, data });
      }
    });
  }
}
