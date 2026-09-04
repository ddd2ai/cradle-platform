/**
 * Operation Progress Throttling
 * 
 * 批次處理 operation progress 更新,降低 React render 頻率。
 * 
 * 核心策略:
 * 1. rAF Throttle: 對齊瀏覽器繪製週期 (~16ms),避免視覺撕裂
 * 2. Min Interval: 至少間隔 100ms,避免高頻 SSE 造成 render storm
 * 3. Latest Value: 保留最新的 progress 值
 * 4. Bypass: completion/failure 事件立即送達,不受 throttle 影響
 */

const PROGRESS_MIN_INTERVAL_MS = 100;

// 在 SSR (node) 環境使用 setTimeout fallback
const scheduleUpdate = typeof requestAnimationFrame === "function"
  ? (fn) => requestAnimationFrame(fn)
  : (fn) => setTimeout(fn, 16);

// operationId -> { operation, listeners: Set, lastPublishedAt: number }
const operationStates = new Map();

// operationId -> rafId (requestAnimationFrame handle 或 setTimeout handle)
const progressTimers = new Map();

/**
 * 訂閱特定 operation 的 progress 更新
 * 
 * @param {string} operationId - Operation ID
 * @param {Function} listener - 接收 operation 物件的回調函式
 * @returns {Function} unsubscribe 函式
 */
export function subscribeOperationProgress(operationId, listener) {
  if (!operationStates.has(operationId)) {
    operationStates.set(operationId, {
      operation: null,
      listeners: new Set(),
      lastPublishedAt: 0,
    });
  }

  const state = operationStates.get(operationId);
  state.listeners.add(listener);

  // 如果已有 operation 資料,立即通知
  if (state.operation) {
    listener(state.operation);
  }

  return () => {
    state.listeners.delete(listener);
    
    // 清理空的 state
    if (state.listeners.size === 0) {
      const timerId = progressTimers.get(operationId);
      if (timerId) {
        clearTimeout(timerId);
        progressTimers.delete(operationId);
      }
      operationStates.delete(operationId);
    }
  };
}

/**
 * 更新 operation progress
 * 會自動 throttle,但 completion/failure 會 bypass
 * 
 * @param {Object} operation - Operation 物件
 */
export function updateOperationProgress(operation) {
  if (!operation?.operationId) {
    return;
  }

  const { operationId, status } = operation;
  if (!operationStates.has(operationId)) {
    operationStates.set(operationId, {
      operation: null,
      listeners: new Set(),
      lastPublishedAt: 0,
    });
  }
  const existing = operationStates.get(operationId).operation;

  // The HTTP 202 response and the runtime stream race each other. A very fast
  // operation can complete over WebSocket before fetch resolves; never let the
  // later accepted snapshot roll authoritative terminal presentation backward.
  if (
    ["completed", "failed", "cancelled"].includes(existing?.status) &&
    !["completed", "failed", "cancelled"].includes(status)
  ) {
    return;
  }

  // Terminal 狀態 (completed/failed/cancelled) 立即送達
  if (["completed", "failed", "cancelled"].includes(status)) {
    flushOperationProgress(operationId);
    publishOperationProgress(operationId, operation);
    
    // 清理資源
    const timerId = progressTimers.get(operationId);
    if (timerId) {
      clearTimeout(timerId);
      progressTimers.delete(operationId);
    }
    return;
  }

  // Progress 狀態使用 throttle
  enqueueOperationProgress(operationId, operation);
}

/**
 * 將 progress 加入 rAF-throttle queue
 * 
 * 策略: rAF + min interval
 * - 第一次更新若距上次發布 >= PROGRESS_MIN_INTERVAL_MS,立即排進下一個 rAF 送出
 * - 否則等待 min interval 結束後,再排一次 rAF
 * 
 * @param {string} operationId
 * @param {Object} operation
 */
function enqueueOperationProgress(operationId, operation) {
  if (!operationStates.has(operationId)) {
    operationStates.set(operationId, {
      operation: null,
      listeners: new Set(),
      lastPublishedAt: 0,
    });
  }

  const state = operationStates.get(operationId);
  state.operation = operation; // 更新最新值

  // 如果已有 timer 在等待,只更新值即可
  if (progressTimers.has(operationId)) {
    return;
  }

  const now = Date.now();
  const elapsed = now - state.lastPublishedAt;

  if (elapsed >= PROGRESS_MIN_INTERVAL_MS) {
    // 距上次發布已夠久 → 下一個 rAF 立即送出 (對齊繪製週期)
    const rafId = scheduleUpdate(() => {
      progressTimers.delete(operationId);
      const latestState = operationStates.get(operationId);
      if (latestState?.operation) {
        publishOperationProgress(operationId, latestState.operation);
      }
    });
    progressTimers.set(operationId, rafId);
  } else {
    // 還在 min interval 冷卻中 → 等冷卻結束再排 rAF
    const remaining = PROGRESS_MIN_INTERVAL_MS - elapsed;
    const timerId = setTimeout(() => {
      progressTimers.delete(operationId);
      const latestState = operationStates.get(operationId);
      if (!latestState?.operation) return;
      // 排進下一個 rAF,確保對齊繪製週期
      scheduleUpdate(() => {
        publishOperationProgress(operationId, latestState.operation);
      });
    }, remaining);
    progressTimers.set(operationId, timerId);
  }
}

/**
 * 立即發布 operation progress (flush pending)
 * @param {string} operationId
 */
function flushOperationProgress(operationId) {
  const timerId = progressTimers.get(operationId);
  if (!timerId) {
    return;
  }

  // 同時取消 setTimeout 和 rAF (cancelAnimationFrame 對 setTimeout handle 無效但不報錯)
  clearTimeout(timerId);
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(timerId);
  }
  progressTimers.delete(operationId);

  const state = operationStates.get(operationId);
  if (state?.operation) {
    publishOperationProgress(operationId, state.operation);
  }
}

/**
 * 發布 operation progress 給所有 listeners
 * @param {string} operationId
 * @param {Object} operation
 */
function publishOperationProgress(operationId, operation) {
  const state = operationStates.get(operationId);
  if (!state) {
    return;
  }

  // 更新 stored operation 與發布時間
  state.operation = operation;
  state.lastPublishedAt = Date.now();

  // 通知所有 listeners
  for (const listener of state.listeners) {
    try {
      listener(operation);
    } catch (error) {
      console.error(`Operation progress listener error:`, error);
    }
  }
}

/**
 * 取得 operation 的當前狀態 (for testing)
 * @param {string} operationId
 * @returns {Object|null}
 */
export function getOperationState(operationId) {
  return operationStates.get(operationId)?.operation ?? null;
}

/**
 * 檢查 operation 是否有 pending throttle (for testing)
 * @param {string} operationId
 * @returns {boolean}
 */
export function hasPendingProgress(operationId) {
  return progressTimers.has(operationId);
}

/**
 * 清空所有 operation states (for testing)
 */
export function clearAllOperationStates() {
  for (const timerId of progressTimers.values()) {
    clearTimeout(timerId);
  }
  progressTimers.clear();
  operationStates.clear();
}

/**
 * 立即 flush 所有 pending progress (for testing)
 */
export function flushAllPendingProgress() {
  for (const operationId of progressTimers.keys()) {
    flushOperationProgress(operationId);
  }
}
