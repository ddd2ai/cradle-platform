/**
 * Log Batch Buffer
 *
 * 符合「Agent Runtime Monitoring Console」定位:
 * - SSE log 事件先進 memory buffer,不直接 setState
 * - 每 75ms rAF-aligned flush 成一批,一次 append N 筆
 * - 使用者看到「持續流入的 log」,React 工作量大幅下降
 *
 * 效果對比 (50 logs/sec):
 *   Before: 50 events → 50 setState → 50 renders × O(n) useMemo
 *   After:  50 events → buffer → 1 flush → 1 setState (append string)
 */

const FLUSH_INTERVAL_MS = 75;

// 未 flush 的 log entries
let pendingEntries = [];

// 批次訂閱者 Set
const batchListeners = new Set();

// flush timer handle
let flushTimer = null;

// SSR / non-browser 環境使用 setTimeout fallback
const scheduleFlush = typeof requestAnimationFrame === "function"
  ? (fn) => requestAnimationFrame(fn)
  : (fn) => setTimeout(fn, 16);

/**
 * 將單筆 log entry 加入 buffer
 * 若 buffer 是空的,排定下一次 flush
 *
 * @param {Object} entry - log entry 物件 ({ id, timestamp, level, message, ... })
 */
export function bufferLogEntry(entry) {
  pendingEntries.push(entry);

  if (flushTimer !== null) {
    return; // 已有 flush 排定中
  }

  // 75ms 後對齊 rAF 執行 flush
  flushTimer = setTimeout(() => {
    scheduleFlush(flushPendingLogs);
  }, FLUSH_INTERVAL_MS);
}

/**
 * 立即 flush buffer 中所有 pending entries
 * 用於 logs.cleared 等需要即時同步的事件,以及測試
 */
export function flushLogBuffer() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  flushPendingLogs();
}

/**
 * 訂閱批次 log 更新
 *
 * @param {Function} listener - (entries: Object[]) => void
 *   entries 是本次 flush 的 log 陣列 (可能 1~N 筆)
 * @returns {Function} unsubscribe 函式
 */
export function subscribeLogBatch(listener) {
  batchListeners.add(listener);
  return () => batchListeners.delete(listener);
}

/**
 * 執行 flush:取出 buffer 並通知所有 listeners
 * @private
 */
function flushPendingLogs() {
  flushTimer = null;

  if (pendingEntries.length === 0) {
    return;
  }

  const batch = pendingEntries.splice(0); // 取出全部並清空

  for (const listener of batchListeners) {
    try {
      listener(batch);
    } catch (error) {
      console.error("Log batch listener error:", error);
    }
  }
}

// ─── Testing / Debug Utilities ───────────────────────────────────────────────

/**
 * 取得目前 buffer 中的 entry 數 (for testing)
 */
export function getPendingLogCount() {
  return pendingEntries.length;
}

/**
 * 重置所有狀態 (for testing)
 */
export function resetLogBuffer() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pendingEntries = [];
  batchListeners.clear();
}
