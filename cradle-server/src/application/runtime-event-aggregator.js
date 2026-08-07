/**
 * RuntimeEventAggregator
 *
 * 坐落於 RuntimeEventBus 與 RuntimeTransport 之間。
 * 負責決定「何時」把事件送往 transport,而 RuntimeEventBus 決定「有誰」在訂閱。
 *
 * 事件分類 (依 Cradle SLA):
 * ─────────────────────────────────────────────────────────────────
 * CRITICAL  立即傳遞,不得遺漏
 *   operation.completed / operation.failed
 *   cell.created / cell.updated (operation terminal)
 *   artifacts.updated (operation terminal)
 *   cultivation.updated (operation terminal)
 *   logs.cleared
 *
 * TRANSIENT 可丟棄中間值,只保留最新 (latest-wins)
 *   operation.updated (progress / stage)
 *   log.appended
 * ─────────────────────────────────────────────────────────────────
 *
 * Phase 1 行為 (本版本):
 *   所有事件立即傳遞,行為與舊 ApplicationEventStream 完全相同。
 *   分類邏輯已建立,Phase 4 只需修改 publish() 的 transient 路徑。
 *
 * Phase 4 extension point:
 *   把 publish() 中 TRANSIENT 路徑改成 latestValues.set(...) + flushTimer
 *   即可達到 50ms latest-wins batching,不需動任何 domain 程式碼。
 */

import { RuntimeEventBus } from "./runtime-event-bus.js";

/**
 * 定義哪些 event type 屬於 CRITICAL (必須立即、不能丟)
 * 不在此清單內的視為 TRANSIENT
 */
const CRITICAL_EVENT_TYPES = new Set([
  "cell.created",
  "cell.updated",
  "artifacts.updated",
  "cultivation.updated",
  "logs.cleared",
]);

/**
 * 判斷 operation.updated 事件是否屬於 CRITICAL
 * (terminal 狀態必須立即送達)
 */
function isTerminalOperation(data) {
  const status = data?.operation?.status;
  return status === "completed" || status === "failed";
}

export class RuntimeEventAggregator {
  /**
   * @param {Object}         opts
   * @param {RuntimeEventBus} opts.eventBus - 內部 event bus 實例
   */
  constructor({ eventBus = new RuntimeEventBus() } = {}) {
    this.eventBus = eventBus;
  }

  // ─── Publisher interface ─────────────────────────────────────────

  /**
   * 發佈事件。
   * Phase 1: 所有事件立即轉發到 eventBus。
   * Phase 4 extension: 修改 TRANSIENT 路徑加入 latest-wins queue。
   *
   * @param {string} type
   * @param {Object} data
   */
  publish(type, data) {
    if (this.#isCritical(type, data)) {
      // CRITICAL: 立即送達
      return this.eventBus.publish(type, data);
    }

    // TRANSIENT: Phase 1 同樣立即送達
    // Phase 4 extension point:
    //   const key = this.#transientKey(type, data);
    //   this.#latestValues.set(key, { type, data });
    //   this.#scheduleFlush();
    //   return;
    return this.eventBus.publish(type, data);
  }

  // ─── Subscriber interface (delegates to eventBus) ────────────────

  /**
   * 訂閱事件 (API 與 RuntimeEventBus 相同)
   * Transport (SSE / WebSocket) 透過此介面接收所有事件
   */
  subscribe(listener, opts) {
    return this.eventBus.subscribe(listener, opts);
  }

  /** 取得事件歷史 (for SSE Last-Event-ID replay) */
  get history() {
    return this.eventBus.history;
  }

  // ─── Classification helpers ──────────────────────────────────────

  /**
   * 判斷事件是否屬於 CRITICAL 類別
   * @param {string} type
   * @param {Object} data
   * @returns {boolean}
   */
  #isCritical(type, data) {
    if (CRITICAL_EVENT_TYPES.has(type)) {
      return true;
    }

    if (type === "operation.updated") {
      return isTerminalOperation(data);
    }

    return false;
  }

  /**
   * Phase 4 extension: 產生 transient 事件的去重 key
   * 例如 "operation.updated:op-123" → latest-wins per operation
   */
  #transientKey(type, data) {
    if (type === "operation.updated" && data?.operation?.operationId) {
      return `${type}:${data.operation.operationId}`;
    }

    return type;
  }
}
