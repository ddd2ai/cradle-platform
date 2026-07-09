# Stability Memory System

## 概念

Stability Memory 讓 Cell 能夠：

1. **記住修復歷史** - 每個 artifact 的執行、修復、穩定化過程
2. **判斷真正穩定** - 不是單次成功，而是連續穩定
3. **追蹤修復次數** - 知道修過幾次、哪些問題
4. **建立問題指紋** - 避免同類問題重複產生 task

## 架構

```text
src/stability/
  ├── stability-store.js       # 儲存穩定狀態
  └── issue-fingerprint.js     # 問題指紋產生器
```

## StabilityStore

### 資料結構

```javascript
{
  "artifacts": {
    "artifact-xxx": {
      "artifactId": "artifact-xxx",
      "status": "stable" | "stabilizing" | "unstable",
      "consecutivePassed": 2,
      "consecutiveNoTask": 2,
      "repairCount": 1,
      "stableAt": "2026-07-09T...",
      "updatedAt": "2026-07-09T...",
      "records": [
        {
          "round": 1,
          "executionStatus": "compile_failed",
          "createdTasks": 1,
          "observationFile": "observation-xxx.md",
          "tasks": [
            { "id": "task-xxx", "title": "修正編譯錯誤" }
          ],
          "createdAt": "2026-07-09T..."
        },
        {
          "round": 2,
          "executionStatus": "passed",
          "createdTasks": 0,
          "observationFile": "observation-yyy.md",
          "tasks": [],
          "createdAt": "2026-07-09T..."
        }
      ]
    }
  }
}
```

### 狀態判斷邏輯

```javascript
// 連續 2 次 passed
if (record.executionStatus === "passed") {
  consecutivePassed += 1;
} else {
  consecutivePassed = 0;
}

// 連續 2 次無新 task
if (record.createdTasks === 0) {
  consecutiveNoTask += 1;
} else {
  consecutiveNoTask = 0;
  repairCount += record.createdTasks;
}

// 穩定條件
if (consecutivePassed >= 2 && consecutiveNoTask >= 2) {
  status = "stable";
  stableAt = new Date().toISOString();
}
```

### API

```javascript
// 讀取所有狀態
await stabilityStore.read();

// 新增 artifact 記錄
await stabilityStore.appendArtifactRecord(artifactId, record);

// 取得 artifact 狀態
await stabilityStore.getArtifactState(artifactId);
```

## Issue Fingerprint

### 用途

為每個執行失敗產生唯一指紋，用於：

1. 判斷是否為相同問題
2. 避免重複建立相同的 repair task
3. 追蹤問題修復歷程

### 演算法

```javascript
fingerprint = sha256(
  artifactId +
  executionStatus +
  stderr (前 5 行) +
  error (前 5 行)
).slice(0, 16)
```

### 範例

```javascript
import { createIssueFingerprint } from "./stability/issue-fingerprint.js";

const fingerprint = createIssueFingerprint({
  artifactId: "artifact-xxx",
  executionResult: {
    status: "compile_failed",
    stderr: "Error: cannot find symbol...",
    error: "",
  },
});

// fingerprint = "a3b4c5d6e7f8g9h0"
```

## 穩定條件演進

### 第一版（已實作）

```javascript
executionResult.status === "passed" && newTasks.length === 0
```

單次成功 + 無新 task = 穩定

**問題：** 可能是偶然成功，不代表真正穩定

### 第二版（現在）

```javascript
consecutivePassed >= 2 && consecutiveNoTask >= 2
```

連續 2 次成功 + 連續 2 次無新 task = 穩定

**改進：** 確保不是偶然，而是持續穩定

### 未來版

```javascript
consecutivePassed >= 3 &&
consecutiveNoTask >= 3 &&
noCodeChange
```

連續 3 次 + 程式碼無變化 = 高度穩定

## 指令

### `/stabilize <artifact-id>`

執行穩定化循環，自動記錄到 StabilityStore。

```bash
/stabilize artifact-xxx
```

**輸出範例：**

```text
Stabilization completed.

Artifact : artifact-xxx
Stable   : yes
Rounds   : 2

History:
- Round 1
  executionStatus: compile_failed
  createdTasks   : 1
  tasks          : 修正編譯錯誤

- Round 2
  executionStatus: passed
  createdTasks   : 0
  tasks          : -
```

### `/stability <artifact-id>`

查詢 artifact 的穩定狀態。

```bash
/stability artifact-xxx
```

**輸出範例：**

```text
📊 Artifact Stability State: artifact-xxx

Status               : stable
Consecutive Passed   : 2
Consecutive No Task  : 2
Repair Count         : 1
Updated At           : 2026-07-09T21:15:30.000Z
Stable At            : 2026-07-09T21:15:30.000Z

Recent Records (last 5):

- Round 1
  Status     : compile_failed
  Tasks      : 1
  Observation: observation-xxx.md
  Created At : 2026-07-09T21:15:00.000Z

- Round 2
  Status     : passed
  Tasks      : 0
  Observation: observation-yyy.md
  Created At : 2026-07-09T21:15:30.000Z
```

## 整合到 CradleCell

### 初始化

```javascript
// 在 prepare() 中
this.stabilityStore = new StabilityStore({
  rootDir: this.rootDir,
});
```

### 使用

```javascript
// 在 stabilizeArtifact() 中
const artifactState = await this.stabilityStore.appendArtifactRecord(
  artifactId,
  {
    round,
    executionStatus: executionResult.status,
    createdTasks: metabolism.created,
    observationFile: metabolism.observationFile,
    tasks: newTasks.map((task) => ({
      id: task.id,
      title: task.title,
    })),
  }
);

// 使用新的穩定條件
if (artifactState.status === "stable") {
  return { stable: true, artifactState, ... };
}
```

## 資料檔案位置

```text
cells/cell-001/
  ├── stability.json          # 穩定狀態記錄
  ├── dna-history.json
  ├── dna-vector.json
  └── ...
```

## 未來擴充

### 1. Task Dedup（下一步）

在 `stabilizeArtifact()` 中：

```javascript
const fingerprint = createIssueFingerprint({
  artifactId,
  executionResult,
});

// 檢查是否已有相同 fingerprint 的 pending task
const existingTask = await this.findTaskByFingerprint(fingerprint);

if (existingTask) {
  // 不建立新 task，直接修復
  await this.repairArtifactFromTask({
    artifactId,
    task: existingTask,
    executionResult,
  });
}
```

### 2. Stability Score

量化穩定程度：

```javascript
stabilityScore = 
  consecutivePassed * 10 +
  consecutiveNoTask * 10 -
  repairCount * 5
```

### 3. Stability Gate

只有達到穩定閾值的 Cell 才能進行分裂/融合：

```javascript
async canDivide() {
  const stableArtifacts = await this.getStableArtifacts();
  return stableArtifacts.length >= 3;
}
```

## 設計原則

### 1. 連續穩定 > 單次成功

單次成功可能是偶然，連續穩定才是真正的穩定。

### 2. 記住歷史

不只看當下，要看過去的修復歷程。

### 3. 避免重複

同類問題不要一直產生新 task。

### 4. 量化穩定

用數字追蹤穩定程度，不只是 boolean。

## 生物類比

```text
Stability Memory = 免疫記憶

第一次感染：
  detect → attack → repair → 辛苦修復

第二次感染同類病原：
  recognize → fast response → 快速修復

連續無感染：
  健康 → 穩定 → 可以分裂
```

## 測試方式

### 測試穩定化循環

```bash
# 第一輪：失敗
/stabilize artifact-test-fail

# 查看狀態
/stability artifact-test-fail
# 應該看到：
# - consecutivePassed: 0
# - consecutiveNoTask: 0
# - status: unstable

# 第二輪：修復後成功
/stabilize artifact-test-fail

# 再查看
/stability artifact-test-fail
# 應該看到：
# - consecutivePassed: 1
# - consecutiveNoTask: 1
# - status: stabilizing

# 第三輪：再次成功
/stabilize artifact-test-fail

# 最後查看
/stability artifact-test-fail
# 應該看到：
# - consecutivePassed: 2
# - consecutiveNoTask: 2
# - status: stable
# - stableAt: (時間戳)
```

## 進度

```text
Self Repair        █████████░  90%
Self Stabilization ████████░░  80%
Stability Memory   ████████░░  80%  ← 現在這裡
Issue Dedup        ███░░░░░░░  30%  ← 下一步
Stable Gate        ██░░░░░░░░  20%
Division/Fusion    ░░░░░░░░░░   0%
```

## 里程碑

✅ Cell 能修好一次
✅ Cell 能反覆修復直到穩定
✅ **Cell 知道某個 artifact 已經趨於穩定** ← 現在
⬜ Cell 不會重複處理同類問題
⬜ Cell 達到穩定閾值後可以分裂

---

**現在 Cell 不只是能修好，而是能記住修過什麼、知道自己穩定到什麼程度。** 🧠✨
