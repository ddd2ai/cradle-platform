/**
 * Resource Invalidation Queue
 * 
 * 提供降頻、合併、去重機制來優化 SSE 事件觸發的 REST refetch。
 * 
 * 核心策略:
 * 1. Leading Edge: 第一個 invalidation 立即觸發刷新 → 消除感知延遲
 * 2. Coalescing: 150ms 內後續的同資源 invalidation 合併為一次 trailing 刷新
 * 3. Batching: 一次刷新視窗內的所有待更新資源
 * 4. Deduplication: 防止並發的重複 request
 * 5. Dirty Flag: 確保不遺漏最終狀態
 */

// ===== Invalidation Queue =====

const pendingResources = new Set();
let trailingTimer = null;
const COALESCE_WINDOW_MS = 150;

const resourceLoaders = new Map()

/**
 * 註冊資源的 loader 函式
 * @param {string} resource - 資源名稱 (例如: 'cells', 'artifacts', 'cultivations')
 * @param {Function} loader - 非同步 loader 函式,回傳 Promise
 */
export function registerResourceLoader(resource, loader) {
  resourceLoaders.set(resource, loader);
  return () => {
    if (resourceLoaders.get(resource) === loader) {
      resourceLoaders.delete(resource);
    }
  };
}

export function reconcileRegisteredResources() {
  return flushInvalidations(Array.from(resourceLoaders.keys()));
}

export function reconcileResources(resources = []) {
  const registered = resources.filter((resource) => resourceLoaders.has(resource));
  return flushInvalidations([...new Set(registered)]);
}

/**
 * 標記資源為「需要刷新」
 * 
 * Leading Edge:第一個 invalidation 立即刷新 (使用者感覺無延遲)
 * Trailing Edge:若 150ms 內又有新 invalidation,結束後再刷新一次 (確保最終狀態)
 * 
 * @param {string} resource - 資源名稱
 */
export function invalidateResource(resource) {
  const isFirstInWindow = pendingResources.size === 0 && !trailingTimer;

  pendingResources.add(resource);

  if (isFirstInWindow) {
    // Leading edge: 立即刷新,給使用者即時回饋
    const resources = Array.from(pendingResources);
    pendingResources.clear();
    flushInvalidations(resources);
  }

  // 重設 trailing timer:確保 burst 結束後仍能拿到最新狀態
  if (trailingTimer) {
    clearTimeout(trailingTimer);
  }

  trailingTimer = setTimeout(() => {
    trailingTimer = null;

    if (pendingResources.size === 0) {
      return;
    }

    const resources = Array.from(pendingResources);
    pendingResources.clear();
    flushInvalidations(resources);
  }, COALESCE_WINDOW_MS);
}

/**
 * 立即刷新所有待處理的 invalidation
 * 用於需要立即同步狀態的情境 (例如測試)
 */
export function flushImmediately() {
  if (trailingTimer) {
    clearTimeout(trailingTimer);
    trailingTimer = null;
  }

  if (pendingResources.size === 0) {
    return;
  }

  const resources = Array.from(pendingResources);
  pendingResources.clear();
  flushInvalidations(resources);
}

/**
 * 批次刷新所有指定的資源
 * @param {string[]} resources - 待刷新的資源清單
 */
async function flushInvalidations(resources) {
  const tasks = [];

  for (const resource of resources) {
    const loader = resourceLoaders.get(resource);

    if (loader) {
      tasks.push(refreshResource(resource, loader));
    }
  }

  await Promise.allSettled(tasks);
}

// ===== In-Flight Request Deduplication =====

const refreshStates = new Map();

/**
 * 取得資源的刷新狀態
 * @param {string} resource - 資源名稱
 * @returns {{ running: boolean, dirty: boolean }}
 */
function getRefreshState(resource) {
  if (!refreshStates.has(resource)) {
    refreshStates.set(resource, {
      running: false,
      dirty: false,
    });
  }

  return refreshStates.get(resource);
}

/**
 * 刷新資源,帶有去重與 dirty flag 機制
 * 
 * 行為:
 * - 如果已有 request 在執行中,標記 dirty 並等待
 * - Request 完成後,如果 dirty=true,再執行一次
 * - 保證最終狀態不會遺漏
 * 
 * @param {string} resource - 資源名稱
 * @param {Function} loader - 非同步 loader 函式
 */
async function refreshResource(resource, loader) {
  const state = getRefreshState(resource);

  if (state.running) {
    state.dirty = true;
    return;
  }

  state.running = true;

  try {
    do {
      state.dirty = false;

      try {
        await loader();
      } catch (error) {
        // Loader 失敗不中斷 dirty check 邏輯
        console.error(`Resource refresh failed for "${resource}":`, error);
      }
    } while (state.dirty);
  } finally {
    state.running = false;
  }
}

// ===== Testing/Debug Utilities =====

/**
 * 取得當前 pending 的資源清單 (for testing)
 * @returns {string[]}
 */
export function getPendingResources() {
  return Array.from(pendingResources);
}

/**
 * 檢查資源是否正在刷新中 (for testing)
 * @param {string} resource
 * @returns {boolean}
 */
export function isRefreshing(resource) {
  return getRefreshState(resource).running;
}

/**
 * 檢查資源是否被標記為 dirty (for testing)
 * @param {string} resource
 * @returns {boolean}
 */
export function isDirty(resource) {
  return getRefreshState(resource).dirty;
}

/**
 * 清空所有 pending invalidations (for testing)
 */
export function clearPendingInvalidations() {
  if (trailingTimer) {
    clearTimeout(trailingTimer);
    trailingTimer = null;
  }

  pendingResources.clear();
}

/**
 * 重置所有狀態 (for testing)
 */
export function resetInvalidationState() {
  clearPendingInvalidations();
  resourceLoaders.clear();
  refreshStates.clear();
}
