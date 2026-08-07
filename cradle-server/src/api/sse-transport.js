/**
 * SseTransport
 *
 * Server-Sent Events transport adapter。
 * 這是 RuntimeEventBus 唯一知道 SSE 協定的地方。
 *
 * 依賴方向:
 *   RuntimeEventBus / RuntimeEventAggregator
 *       ↓  (subscribe)
 *   SseTransport  ←── 唯一知道 HTTP streaming、SSE 格式的模組
 *       ↓  (write)
 *   HTTP response stream (Node.js)
 *
 * 未來新增 WebSocket:
 *   只需建立 WebSocketTransport,訂閱同一個 eventBus,
 *   完全不需要修改任何 domain / application 程式碼。
 */

/**
 * 將 RuntimeEventBus 事件物件格式化為 SSE wire format
 * @param {Object} event
 * @returns {string}
 */
export function formatServerSentEvent(event) {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify({ ...event.data, occurredAt: event.occurredAt })}`,
    "",
    "",
  ].join("\n");
}

/**
 * 建立 SSE HTTP response descriptor
 *
 * 回傳的物件由 http-server.js 的 streaming 邏輯消費:
 *   result.streamResponse === true → 啟動 streaming 模式
 *   result.subscribe(write)        → 訂閱事件並寫入 response
 *
 * @param {Object} opts
 * @param {import('../application/runtime-event-bus.js').RuntimeEventBus
 *       | import('../application/runtime-event-aggregator.js').RuntimeEventAggregator} opts.eventBus
 * @param {string} [opts.lastEventId] - SSE Last-Event-ID header,用於斷線重連補送
 * @returns {Object} stream response descriptor
 */
export function createSseResponse({ eventBus, lastEventId }) {
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
      return eventBus.subscribe(
        (event) => write(formatServerSentEvent(event)),
        { afterEventId: lastEventId },
      );
    },
  };
}

/**
 * 向後相容的別名 (供舊的 api-routes.js import 使用)
 * 未來可移除
 *
 * @deprecated 新程式碼請使用 createSseResponse({ eventBus })
 */
export function createApplicationEventResponse({ eventStream, eventBus, lastEventId }) {
  return createSseResponse({
    eventBus: eventBus ?? eventStream,
    lastEventId,
  });
}
