/**
 * RuntimeEventBus
 *
 * 純粹的 pub/sub + event history。
 * 這是 Domain 與 Application 層唯一知道的事件通道。
 *
 * 依賴方向規則:
 *   Domain ──► RuntimeEventBus ◄── Transport (SSE / WebSocket)
 *
 * 刻意不包含任何 HTTP、SSE、WebSocket 知識。
 * Transport 透過 subscribe() 接收事件並自行決定如何傳遞。
 */

const DEFAULT_HISTORY_LIMIT = 500;

export class RuntimeEventBus {
  constructor({
    historyLimit = DEFAULT_HISTORY_LIMIT,
    now = () => new Date(),
  } = {}) {
    this.historyLimit = historyLimit;
    this.now = now;
    this.nextId = 1;
    this.history = [];
    this.subscribers = new Set();
  }

  /**
   * 發佈事件
   * @param {string} type   - 事件類型,例如 "operation.updated"
   * @param {Object} data   - 事件 payload
   * @returns {Object} canonical runtime event (id, type, timestamp, payload)
   */
  publish(type, data) {
    if (!type) {
      throw new Error("Runtime event type is required");
    }

    const event = {
      id: String(this.nextId),
      type,
      timestamp: this.now().toISOString(),
      payload: data,
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

  /**
   * 訂閱事件
   * @param {Function} listener         - (event) => void
   * @param {Object}   [opts]
   * @param {string}   [opts.afterEventId] - 若提供,補送 history 中 id > afterEventId 的事件
   * @returns {Function} unsubscribe 函式
   */
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
    // 事件傳遞不得讓發佈端操作失敗
  }
}
