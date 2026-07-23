# Stability Memory Implementation Summary

## 實作日期

2026-07-09

## 目標

讓 Cell 記住修復歷史、判斷真正穩定、避免重複問題。

```text
Self Repair → Stability Memory → Issue Dedup → Stable Gate → Division/Fusion
```

## 核心概念

### 單次成功 ≠ 真正穩定

```text
第一版：passed + no task = stable (可能是偶然)

第二版：連續 2 次 passed + 連續 2 次 no task = stable (持續穩定)
```

### 記住歷史 = 免疫記憶

```text
第一次感染：辛苦修復
第二次感染：快速識別
連續無感染：健康穩定
```

## 新增檔案

### 1. `src/stability/stability-store.js`

儲存每個 artifact 的穩定狀態。

**資料結構：**

```javascript
{
  "artifacts": {
    "artifact-xxx": {
      "artifactId": "artifact-xxx",
      "status": "stable",
      "consecutivePassed": 2,
      "consecutiveNoTask": 2,
      "repairCount": 1,
      "stableAt": "2026-07-09T...",
      "updatedAt": "2026-07-09T...",
      "records": [...]
    }
  }
}
```

**API：**

- `read()` - 讀取所有狀態
- `write(state)` - 寫入狀態
- `appendArtifactRecord(artifactId, record)` - 新增記錄並更新狀態
- `getArtifactState(artifactId)` - 取得特定 artifact 狀態

**穩定判斷：**

```javascript
if (consecutivePassed >= 2 && consecutiveNoTask >= 2) {
  status = "stable";
  stableAt = new Date().toISOString();
}
```

### 2. `src/stability/issue-fingerprint.js`

為執行失敗產生唯一指紋。

**演算法：**

```javascript
fingerprint = sha256(
  artifactId +
  executionStatus +
  stderr (前 5 行) +
  error (前 5 行)
).slice(0, 16)
```

**用途：**

- 判斷是否為相同問題
- 避免重複建立相同的 repair task
- 追蹤問題修復歷程

## 修改檔案

### 1. `src/cradle-cell.js`

#### Import

```javascript
import { StabilityStore } from "./stability/stability-store.js";
```

#### 初始化

```javascript
// 在 prepare() 中
this.stabilityStore = new StabilityStore({
  rootDir: this.rootDir,
});
```

#### 修改 stabilizeArtifact()

**新增狀態記錄：**

```javascript
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
```

**新的穩定條件：**

```javascript
// 從單次判斷
if (executionResult.status === "passed" && newTasks.length === 0) {
  return { stable: true, ... };
}

// 改為連續判斷
if (artifactState.status === "stable") {
  return { stable: true, artifactState, ... };
}
```

**回傳值增強：**

```javascript
return {
  stable: true,
  artifactId,
  rounds: round,
  artifactState,  // 新增：包含完整穩定狀態
  history,
};
```

### 2. `src/commands/execution-commands.js`

#### 新增 `/stability` 指令

查詢 artifact 的穩定狀態。

```bash
/stability <artifact-id>
```

**功能：**

- 顯示穩定狀態（stable/stabilizing/unstable）
- 顯示連續成功次數
- 顯示連續無 task 次數
- 顯示修復次數
- 顯示最近 5 次記錄

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

## 資料流程

```text
/stabilize artifact-xxx
  ↓
stabilizeArtifact()
  ↓
for each round:
  1. execute artifact
  2. metabolize stimulus
  3. appendArtifactRecord() → StabilityStore
     ↓
     更新 consecutivePassed
     更新 consecutiveNoTask
     計算 repairCount
     判斷 status (stable/stabilizing/unstable)
  4. 檢查 artifactState.status
     ↓
     stable → 回傳成功
     not stable → repair & continue
  ↓
回傳結果 (包含 artifactState)
```

## 狀態轉換

```text
unstable (初始)
  ↓
  passed + no task (第一次)
  ↓
stabilizing (consecutivePassed=1, consecutiveNoTask=1)
  ↓
  passed + no task (第二次)
  ↓
stable (consecutivePassed=2, consecutiveNoTask=2)
  ↓
  如果之後 failed 或有 task
  ↓
stabilizing (計數器歸零，重新累積)
```

## 使用方式

### 基本流程

```bash
# 1. 執行穩定化
/stabilize artifact-xxx

# 2. 查看狀態
/stability artifact-xxx

# 3. 如果未穩定，再次執行
/stabilize artifact-xxx

# 4. 再次查看
/stability artifact-xxx
```

### 測試案例

#### 案例 1：首次成功

```bash
/stabilize artifact-test-pass
```

**結果：**

```text
- Round 1: passed, 0 tasks
  → consecutivePassed: 1
  → consecutiveNoTask: 1
  → status: stabilizing (還需要再一次)
```

#### 案例 2：失敗後修復

```bash
/stabilize artifact-test-fail
```

**結果：**

```text
- Round 1: compile_failed, 1 task
  → consecutivePassed: 0
  → consecutiveNoTask: 0
  → status: unstable

- Round 2: passed, 0 tasks
  → consecutivePassed: 1
  → consecutiveNoTask: 1
  → status: stabilizing

(需要再執行一次)

/stabilize artifact-test-fail

- Round 1: passed, 0 tasks
  → consecutivePassed: 2
  → consecutiveNoTask: 2
  → status: stable ✅
```

## 資料檔案

### 位置

```text
cells/cell-001/
  └── stability.json
```

### 範例內容

```json
{
  "artifacts": {
    "artifact-20260709-210000": {
      "artifactId": "artifact-20260709-210000",
      "status": "stable",
      "consecutivePassed": 2,
      "consecutiveNoTask": 2,
      "repairCount": 1,
      "stableAt": "2026-07-09T21:15:30.000Z",
      "updatedAt": "2026-07-09T21:15:30.000Z",
      "records": [
        {
          "round": 1,
          "executionStatus": "compile_failed",
          "createdTasks": 1,
          "observationFile": "observation-20260709-210100.md",
          "tasks": [
            {
              "id": "task-20260709-210100-a3b4c5d6",
              "title": "修正編譯錯誤"
            }
          ],
          "createdAt": "2026-07-09T21:01:00.000Z"
        },
        {
          "round": 2,
          "executionStatus": "passed",
          "createdTasks": 0,
          "observationFile": "observation-20260709-211530.md",
          "tasks": [],
          "createdAt": "2026-07-09T21:15:30.000Z"
        }
      ]
    }
  }
}
```

## 技術細節

### 語法驗證

所有新增/修改的檔案都通過語法檢查：

```bash
node -c src/stability/stability-store.js      ✅
node -c src/stability/issue-fingerprint.js    ✅
node -c src/cradle-cell.js                    ✅
node -c src/commands/execution-commands.js    ✅
```

### Import 路徑

```javascript
// CradleCell
import { StabilityStore } from "./stability/stability-store.js";

// 使用 issue-fingerprint (未來)
import { createIssueFingerprint } from "./stability/issue-fingerprint.js";
```

## 下一步：Issue Dedup

### 目標

避免同類問題重複產生 task。

### 實作方式

在 `stabilizeArtifact()` 中：

```javascript
// 產生問題指紋
const fingerprint = createIssueFingerprint({
  artifactId,
  executionResult,
});

// 檢查是否已有相同問題的 pending task
const existingTask = await this.findTaskByFingerprint(fingerprint);

if (existingTask) {
  // 使用現有 task 修復，不建立新 task
  await this.repairArtifactFromTask({
    artifactId,
    task: existingTask,
    executionResult,
  });
} else {
  // 建立新 task (透過 metabolize)
  // ...
}
```

### 需要修改

1. Task schema 加入 `issueFingerprint` 欄位
2. 新增 `findTaskByFingerprint()` 方法
3. Metabolize 時產生 fingerprint
4. StabilityStore 記錄 fingerprint

## 進度追蹤

```text
✅ Self Repair Loop              100%
✅ Self Stabilization Loop       100%
✅ Stability Memory System        80%  ← 現在完成
⬜ Issue Dedup                    30%  ← 下一步
⬜ Stable Gate                    20%
⬜ Division/Fusion                 0%
```

## 里程碑

✅ **Cell 能修好一次**
✅ **Cell 能反覆修復直到穩定**
✅ **Cell 知道某個 artifact 已經趨於穩定** ← 現在達成
⬜ Cell 不會重複處理同類問題
⬜ Cell 達到穩定閾值後可以分裂

## Commit 建議

```bash
git add .

git commit -m "feat(stability): add stability memory system" \
-m "Track artifact stability state with consecutive success counting." \
-m "Change stable condition from single success to consecutive 2x success." \
-m "Add /stability command to query artifact stability state." \
-m "Add issue fingerprint generator for future task deduplication."
```

## 影響範圍

這次實作讓 Cradle Cell 具備了：

### 1. 記憶能力

不只看當下，還記得過去的修復歷程。

### 2. 判斷能力

不是單次成功就判斷穩定，而是連續觀察後判斷。

### 3. 追蹤能力

知道修過幾次、哪些問題、最近表現如何。

### 4. 基礎設施

為未來的 task dedup、stable gate、division/fusion 打下基礎。

## 生物類比

```text
Stability Memory = 免疫記憶 + 健康評估

免疫記憶：
  記住遇過的病原
  第二次感染快速反應

健康評估：
  不是「今天沒生病」就是健康
  而是「連續一週沒生病」才是健康

穩定閾值：
  只有健康穩定的細胞才能分裂
  生病的細胞不應該複製
```

## 設計哲學

### 1. 連續 > 單次

單次成功可能是運氣，連續成功才是實力。

### 2. 記住 > 遺忘

過去的修復經驗是寶貴的知識。

### 3. 量化 > 模糊

用明確的數字追蹤穩定程度。

### 4. 漸進 > 跳躍

從 unstable → stabilizing → stable，不是一步到位。

---

**現在 Cell 不只是會修，而是知道自己修得好不好、穩不穩定。** 🧠✨
