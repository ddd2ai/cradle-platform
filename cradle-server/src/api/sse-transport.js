import {
  formatServerSentEvent,
  SseRuntimeEventTransport,
} from "../application/runtime/sse-runtime-event-transport.js";

export { formatServerSentEvent };

export function createSseResponse({ eventBus, lastEventId }) {
  const transport = new SseRuntimeEventTransport({
    eventHistory: () => eventBus.history ?? [],
    heartbeatIntervalMs: 0,
  });
  const unsubscribe = eventBus.subscribe((event) => transport.publish(event));

  return {
    streamResponse: true,
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
    openResponse(response) {
      const remove = transport.addClient(response, { afterEventId: lastEventId });
      return () => {
        remove();
        unsubscribe();
        transport.stop();
      };
    },
    subscribe(write) {
      return this.openResponse({ write });
    },
  };
}

export function createApplicationEventResponse({ eventStream, eventBus, lastEventId }) {
  return createSseResponse({
    eventBus: eventBus ?? eventStream,
    lastEventId,
  });
}
