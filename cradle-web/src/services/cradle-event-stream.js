import { updateOperationProgress } from "./operation-progress.js";
import { bufferLogEntry, flushLogBuffer } from "./log-buffer.js";
import { reconcileRegisteredResources } from "./resource-invalidation.js";
import { RuntimePresentationStore } from "./runtime/runtime-presentation-store.js";
import { WebSocketRuntimeEventClient } from "./runtime/websocket-runtime-event-client.js";

const presentationStore = new RuntimePresentationStore();
let runtimeEventClient = createDefaultRuntimeEventClient();
let bridgeDisconnect = null;
let subscriberCount = 0;

export function subscribeToCradleEvents(listener) {
  const unsubscribe = presentationStore.subscribe((events) => {
    for (const event of events) {
      listener(event);
    }
  });
  subscriberCount += 1;
  ensureBridge();

  return () => {
    unsubscribe();
    subscriberCount -= 1;
    if (subscriberCount === 0) {
      disconnectBridge();
    }
  };
}

export function configureRuntimeEventClient(client) {
  disconnectBridge();
  runtimeEventClient = client;
  if (subscriberCount > 0) {
    ensureBridge();
  }
}

function ensureBridge() {
  if (bridgeDisconnect) return;

  const unsubscribeEvents = runtimeEventClient.subscribe(handleRuntimeEvent);
  const unsubscribeConnection = runtimeEventClient.subscribeConnection((state) => {
    if (state.connected && state.reconnected) {
      reconcileRegisteredResources();
    }
  });
  runtimeEventClient.connect();

  bridgeDisconnect = () => {
    unsubscribeEvents();
    unsubscribeConnection();
    runtimeEventClient.disconnect();
    bridgeDisconnect = null;
  };
}

function disconnectBridge() {
  bridgeDisconnect?.();
}

function handleRuntimeEvent(event) {
  if (!event || typeof event.type !== "string") {
    return;
  }

  const canonicalEvent = {
    ...event,
    payload: event.payload ?? event.data ?? {},
  };
  const { payload, type } = canonicalEvent;

  if (type === "operation.updated" && payload.operation) {
    updateOperationProgress(payload.operation);
    if (["completed", "failed"].includes(payload.operation.status)) {
      reconcileRegisteredResources();
    }
  }

  if (type === "log.appended" && payload.entry) {
    bufferLogEntry(payload.entry);
    return;
  }

  if (type === "logs.cleared") {
    flushLogBuffer();
  }

  presentationStore.enqueue(canonicalEvent);
}

function createDefaultRuntimeEventClient() {
  return new WebSocketRuntimeEventClient(() => {
    if (typeof window === "undefined") {
      return "ws://localhost/api/v1/runtime/events";
    }

    const url = new URL("/api/v1/runtime/events", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  });
}
