# SSE 事件處理效能分析報告

## 執行摘要

本報告分析 Cradle Web 現有的 SSE (Server-Sent Events) 事件處理架構,識別效能瓶頸並提供優化建議。

## 現況架構

### 1. SSE 事件流架構

```
Server SSE Endpoint (/api/v1/events)
           ↓
    EventSource (shared)
           ↓
  subscribeToCradleEvents()
           ↓
    ┌──────┴──────┐
    │             │
 App.jsx    CreationsPage
LogsPage    IncubatorPage
            cradleClient.js
```

### 2. 事件類型

**Domain Events** (資源變更通知):
- `cell.created` - Cell 建立
- `cell.updated` - Cell 更新
- `artifacts.updated` - Artifacts 更新
- `cultivation.updated` - Cultivation 狀態更新

**Operation Events** (操作進度):
- `operation.updated` - 操作進度更新 (Planning → Creating Child → Creating Products 32% → ... → Handoff)

**Log Events**:
- `log.appended` - 日誌追加
- `logs.cleared` - 日誌清除

## 識別的效能問題

### 問題 1: 立即式 REST Refetch (Render Storm)

**位置**: `App.jsx` line 113-129

```javascript
useEffect(() => subscribeToCradleEvents((event) => {
  if (["cell.created", "cell.updated"].includes(event.type)) {
    loadCells({ showLoading: false }).catch(() => {}); // ❌ 立即 refetch
    
    const selectedId = selectedCellIdRef.current;
    const affectedCellIds = event.data.cellIds ?? [/*...*/];
    if (selectedId && affectedCellIds.includes(selectedId)) {
      loadSelectedCell(selectedId).catch(() => {}); // ❌ 立即 refetch
    }
    return;
  }
  // ...
}), []);
```

**問題**:
- 每個 `cell.updated` 事件都觸發 `fetchCells()` REST 呼叫
- 在 Divide 操作期間,可能在短時間內產生:
  ```
  cell.updated (parent)
  cell.created (child)
  cell.updated (parent again)
  cell.updated (child)
  cultivation.updated
  artifacts.updated
  ```
- 6 個事件 → 最多 6 次 REST request → 6 次 state update → 多次 render

**影響**:
- Network: 重複的並發 GET 請求
- React: 快速連續的 setState 造成 render cascade
- UX: UI 可能出現閃爍或卡頓

---

### 問題 2: CreationsPage - 無批次的資源刷新

**位置**: `CreationsPage.jsx` line 50-54

```javascript
const unsubscribe = subscribeToCradleEvents((event) => {
  if (event.type === "artifacts.updated") {
    loadCreations(); // ❌ 每次事件立即 reload
  }
});
```

**問題**:
- 每個 `artifacts.updated` 事件立即呼叫 `getCreations()`
- 沒有 debounce 或 coalesce 機制
- Divide 操作可能觸發多次 artifacts 更新

**影響**:
- 在 Creations 頁面開啟時,每次 artifact 變更都觸發完整的 REST fetch

---

### 問題 3: Operation Progress - 每個百分比都更新 React State

**位置**: `IncubatorPage.jsx` operation handlers

```javascript
async function handleDivide(event) {
  // ...
  const result = await divideCell(
    selectedCellId,
    { childCellId },
    { onProgress: setOperationProgress }, // ❌ 每個進度都 setState
  );
  // ...
}
```

**追蹤至**: `cradleClient.js` line 364-375

```javascript
const unsubscribe = subscribeToCradleEvents((event) => {
  const operation = event.type === "operation.updated"
    ? event.data.operation
    : null;

  if (operation?.operationId === operationId) {
    onProgress?.(operation); // ❌ 直接呼叫 setState
  }
  // ...
});
```

**問題**:
- 每個 SSE progress event 直接呼叫 `setOperationProgress()`
- Progress 可能每秒更新多次:
  ```
  Creating Products 32%
  Creating Products 34%
  Creating Products 37%
  Creating Products 39%
  Creating Products 41%
  ...
  ```
- 每個百分比都觸發 React re-render

**影響**:
- 不必要的高頻率 render
- Progress bar 不需要 60 FPS 更新率
- 10-15 FPS 已經足夠流暢

---

### 問題 4: Operation State 未隔離

**位置**: `IncubatorPage.jsx` state structure

```javascript
function IncubatorPage({
  cells, isLoading, error, onReloadCells, onCreateCell,
}) {
  const [selectedCellId, setSelectedCellId] = useState(undefined);
  const [operationProgress, setOperationProgress] = useState(null); // ❌ 與主要 state 混合
  const [operationDialog, setOperationDialog] = useState(null);
  // ...
  
  return (
    <>
      <IncubatorWorkspace cells={cells} /* ... */ />
      <CellInspectorDrawer cell={selectedCell} /* ... */ />
      <CellOperationDialogs 
        operationProgress={operationProgress} // ❌ progress change 可能觸發整個 tree re-render
      />
    </>
  );
}
```

**問題**:
- `operationProgress` state 變更會觸發 `IncubatorPage` re-render
- 可能造成不必要的子元件 re-render cascade:
  ```
  operation progress 41%
         ↓
  IncubatorPage render
         ↓
  IncubatorWorkspace render
  CellInspectorDrawer render
  CellOperationDialogs render
  ```

**理想架構**:
- Operation state 應該隔離在獨立 store
- 只有消費 operation state 的元件才 re-render

---

### 問題 5: 無 In-Flight Request 去重

**位置**: `App.jsx` loadCells function

```javascript
async function loadCells({ showLoading = true } = {}) {
  try {
    if (showLoading) {
      setIsLoadingCells(true);
    }
    setCellsError(null);
    const loadedCells = await fetchCells(); // ❌ 無去重機制
    setCells(loadedCells);
    return loadedCells;
  } catch (error) {
    setCellsError(error.message);
    throw error;
  } finally {
    if (showLoading) {
      setIsLoadingCells(false);
    }
  }
}
```

**問題**:
- 如果在 `loadCells()` 執行期間收到新的 `cell.updated` 事件
- 會發起第二個平行的 `fetchCells()` request
- 沒有 request deduplication 或 dirty flag 機制

**情境**:
```
t=0ms:    GET /api/v1/cells (開始)
t=50ms:   cell.updated event → 觸發第二個 GET
t=100ms:  GET /api/v1/cells (第二個開始) ❌ 重複
t=150ms:  第一個 GET 完成
t=200ms:  第二個 GET 完成 (浪費)
```

---

## 建議的優化策略

### 優化 1: Domain Invalidation Queue (Priority: HIGH)

**目標**: 將重複的資源 invalidation 在 150ms 視窗內合併

**實作**:
```javascript
// 新檔案: cradle-web/src/services/resource-invalidation.js

const pendingResources = new Set();
let refreshTimer = null;

export function invalidateResource(resource) {
  pendingResources.add(resource);
  
  if (refreshTimer) {
    return;
  }
  
  refreshTimer = setTimeout(() => {
    const resources = Array.from(pendingResources);
    pendingResources.clear();
    refreshTimer = null;
    
    flushInvalidations(resources);
  }, 150);
}
```

**效益**:
```
Before:
  5 events → 5 REST requests → 5 state updates

After:
  5 events → (150ms coalesce) → 1-3 REST requests → 1 state update wave
```

---

### 優化 2: Operation Progress Throttling (Priority: HIGH)

**目標**: 將 progress 更新降頻至 100ms

**實作**:
```javascript
// 在 cradle-event-stream.js 加入

const pendingOperations = new Map();
let progressTimer = null;

function enqueueOperationProgress(operation) {
  // Completion/failure bypass throttle
  if (['completed', 'failed'].includes(operation.status)) {
    flushOperationUpdates();
    publishOperationUpdate(operation);
    return;
  }
  
  pendingOperations.set(operation.id, operation);
  
  if (progressTimer) {
    return;
  }
  
  progressTimer = setTimeout(() => {
    flushOperationUpdates();
  }, 100);
}

function flushOperationUpdates() {
  if (progressTimer) {
    clearTimeout(progressTimer);
    progressTimer = null;
  }
  
  const updates = Array.from(pendingOperations.values());
  pendingOperations.clear();
  
  updates.forEach(publishOperationUpdate);
}
```

**效益**:
```
Before:
  10 progress events per second → 10 React renders per second

After:
  10 progress events per second → ~10 React renders per second (100ms throttle)
  進度條仍然流暢,但 render overhead 降低 ~90%
```

---

### 優化 3: In-Flight Request Deduplication (Priority: MEDIUM)

**目標**: 防止並發的重複 REST request,並處理 dirty flag

**實作**:
```javascript
// resource-invalidation.js

const refreshStates = new Map();

function getRefreshState(resource) {
  if (!refreshStates.has(resource)) {
    refreshStates.set(resource, {
      running: false,
      dirty: false,
    });
  }
  return refreshStates.get(resource);
}

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
      await loader();
    } while (state.dirty);
  } finally {
    state.running = false;
  }
}
```

**效益**:
- 防止並發的重複 request
- 保證不會遺漏最終狀態 (dirty flag 機制)

---

### 優化 4: Operation State Isolation (Priority: MEDIUM)

**目標**: 將 operation state 從主元件隔離,使用獨立 store

**實作**:
```javascript
// 新檔案: cradle-web/src/stores/operation-store.js

import { useSyncExternalStore } from 'react';

const operationListeners = new Set();
const operations = new Map();

export function updateOperation(operation) {
  operations.set(operation.id, operation);
  operationListeners.forEach(listener => listener());
}

export function subscribeOperations(listener) {
  operationListeners.add(listener);
  return () => operationListeners.delete(listener);
}

export function getOperation(operationId) {
  return operations.get(operationId);
}

export function useOperation(operationId) {
  return useSyncExternalStore(
    subscribeOperations,
    () => getOperation(operationId)
  );
}
```

**效益**:
- Operation progress 變更只影響 `CellOperationDialogs`
- 不會觸發 `IncubatorPage` 或其他子元件 re-render

---

## 預期改善

### 網路層
- **Before**: Divide 可能產生 5-8 個並發 REST requests
- **After**: Divide 最多 2-3 個批次 REST requests
- **改善**: ~60-70% request 減少

### React Rendering
- **Before**: Progress 每秒 ~15-30 renders
- **After**: Progress 每秒 ~10 renders
- **改善**: ~50-70% render 減少

### 使用者體驗
- 減少 UI 閃爍
- 更流暢的操作體驗
- 降低瀏覽器 CPU 使用率

---

## 實作順序建議

1. **Phase 1**: Domain Invalidation (1-2 hours)
   - 建立 `resource-invalidation.js`
   - 重構 `App.jsx` 事件處理
   - 測試 coalescing 行為

2. **Phase 2**: Operation Progress Throttling (1 hour)
   - 修改 `cradle-event-stream.js`
   - 更新 `cradleClient.js` progress handling
   - 測試 throttle + completion bypass

3. **Phase 3**: In-Flight Deduplication (1 hour)
   - 加入 refresh state management
   - 實作 dirty flag 邏輯
   - 測試並發情境

4. **Phase 4**: Operation State Isolation (2-3 hours)
   - 建立 `operation-store.js`
   - 重構 `IncubatorPage` state
   - 更新 `CellOperationDialogs` 使用 hook
   - 測試 render isolation

5. **Phase 5**: Testing & Validation (1-2 hours)
   - E2E 測試 Divide flow
   - 驗證 event burst scenarios
   - Performance profiling

---

## 範圍限制 (不包含)

本次優化 **不會** 改動:
- ❌ Server SSE emission logic
- ❌ REST/SSE architecture (保持現有設計)
- ❌ WebSocket migration (不引入)
- ❌ EventSource connection management (保持 shared connection)
- ❌ 202 + operationId contract (保持不變)
- ❌ REST reconciliation fallback (保持不變)

---

## 下一步

請確認此分析是否符合預期,然後我將開始實作:
1. Phase 1: Domain Invalidation Queue
2. Phase 2: Operation Progress Throttling
3. Phase 3: In-Flight Deduplication
4. Phase 4: Operation State Isolation
5. Phase 5: Testing

每個 phase 完成後將進行驗證,確保沒有 regression。
