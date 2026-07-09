# Artifact Self-Stabilization Loop - Implementation Summary

## 實作日期

2026-07-09

## 目標

讓 Cradle Cell 能夠反覆執行、感知、修復 artifact，直到穩定。

```text
執行 → 感知 → 修復 → 再執行 → 穩定
```

## 修改檔案

### 1. `src/production/production-prompts.js`

**新增：** `buildArtifactExecutionRepairPrompt()`

處理 execution feedback 的 prompt builder：

- 忠實遵守 Original Goal
- 只修正 Task 與 Execution Result 指出的問題
- 不擴大修改範圍
- 不任務漂移

### 2. `src/production/artifact-production-service.js`

**新增：** `repairArtifactFromExecution()`

根據 execution result 修復 artifact：

- 讀取現有 artifact
- 呼叫 LLM 修復
- 保留原 artifact ID
- 正規化 & 驗證
- 儲存並記錄

### 3. `src/cradle-cell.js`

#### 修改 task ID 生成

```javascript
// Before
id: `task-${this.formatTimestamp(new Date())}`

// After
id: `task-${this.formatTimestamp(new Date())}-${crypto.randomUUID().slice(0, 8)}`
```

避免同一秒建立多個 task 時 ID 重複。

#### 新增方法

**`repairArtifactFromTask()`**

```javascript
async repairArtifactFromTask({
  artifactId,
  task,
  executionResult,
})
```

- 呼叫 production service repair
- 完成 task

**`stabilizeArtifact()`**

```javascript
async stabilizeArtifact({
  artifactId,
  maxRounds = 3,
})
```

執行多輪穩定化循環：

1. 執行 artifact
2. Metabolize stimulus
3. 檢查穩定條件
4. 如果不穩定，repair 並重新執行
5. 最多 3 輪

**穩定條件（第一版）：**

```javascript
executionResult.status === "passed" && newTasks.length === 0
```

### 4. `src/commands/execution-commands.js`

**新增指令：** `/stabilize <artifact-id>`

執行 artifact 穩定化循環，顯示結果：

- 是否穩定
- 執行輪數
- 每輪的執行狀態、建立的 task

### 5. 文件

**新增：** `docs/STABILIZATION_QUICK_START.md`

快速開始指南，包含：

- 概念說明
- 使用範例
- 配置選項
- 流程圖
- 內部機制
- 設計原則

## 核心機制

### 穩定化循環

```text
Round 1:
  execute artifact
  metabolize stimulus
  if passed && no task → stable
  else repair artifact

Round 2:
  execute repaired artifact
  metabolize stimulus
  if passed && no task → stable
  else repair again

Round 3:
  最多再試一次
```

### Task 追蹤

```javascript
const beforeTasks = await this.readTasks();
const beforeTaskIds = new Set(beforeTasks.map((task) => task.id));

// ... execute & metabolize ...

const afterTasks = await this.readTasks();
const newTasks = afterTasks.filter(
  (task) =>
    task.status === "pending" &&
    !beforeTaskIds.has(task.id)
);
```

只處理新產生的 pending task。

### History 記錄

```javascript
{
  round: 1,
  executionStatus: "compile_failed",
  createdTasks: 1,
  observationFile: "observation-xxx.md",
  newTasks: [
    { id: "task-xxx", title: "修正編譯錯誤" }
  ]
}
```

每一輪都記錄完整資訊。

## 使用方式

### 基本用法

```bash
/use cell-001
/stabilize artifact-test-pass
```

### 測試失敗案例

```bash
/stabilize artifact-test-compile-fail
```

### 程式化呼叫

```javascript
const result = await cell.stabilizeArtifact({
  artifactId: "artifact-xxx",
  maxRounds: 3,
});

console.log(result.stable);  // true | false
console.log(result.rounds);  // 1 | 2 | 3
console.log(result.history); // 每輪詳細記錄
```

## 回傳值結構

```javascript
{
  stable: boolean,
  artifactId: string,
  rounds: number,
  reason?: string,
  history: [
    {
      round: number,
      executionStatus: string,
      createdTasks: number,
      observationFile: string,
      newTasks: Array<{id: string, title: string}>
    }
  ]
}
```

## 設計原則

### 1. 不另開巨大架構

沿用既有管線：

```text
/execute
  ↓
cell.executeArtifact()
  ↓
ArtifactExecutionService
  ↓
ExecutionResult
  ↓
Stimulus
```

### 2. 反覆測試後趨向穩定

第一版穩定條件簡單明確：

- 執行成功
- 不再產生新 task

### 3. Self Repair Loop

Cell 能自我修正產物，直到同一類刺激不再產生修復任務。

### 4. 忠實於 Original Goal

Repair 不改變原目標，只修正執行問題。

## 未來擴充

### 下一步

1. **Task Dedup**
   - 相同問題 → 更新同一個 task
   - 避免重複建立相同修復任務

2. **Stability Memory**
   - 記住哪些 artifact 已穩定
   - 避免重複檢查

3. **進階穩定條件**
   - 連續 N 輪無新 task
   - 執行結果無變化
   - 程式碼無變化

### 以後

4. **DNA Stability Gate**
   - 根據 DNA trait 判斷穩定閾值
   - 不同 cell 有不同穩定標準

5. **Stability Score**
   - 量化穩定程度
   - 記錄在 artifact metadata

## 測試建議

### 測試案例 1：成功 Artifact

```bash
/stabilize artifact-test-pass
```

**預期：**

- Stable: yes
- Rounds: 1
- Round 1: passed, 0 tasks

### 測試案例 2：失敗後修復成功

```bash
/stabilize artifact-test-compile-fail
```

**預期（理想）：**

- Stable: yes
- Rounds: 2
- Round 1: compile_failed, 1 task
- Round 2: passed, 0 tasks

### 測試案例 3：無法修復

如果 cell 無法修復問題：

**預期：**

- Stable: no
- Reason: max rounds reached
- Rounds: 3
- 每輪都失敗

## 技術細節

### Import 更新

```javascript
// cradle-cell.js
import crypto from "crypto";

// artifact-production-service.js
import {
  buildProductionPrompt,
  buildArtifactRepairPrompt,
  buildArtifactExecutionRepairPrompt,  // 新增
} from "./production-prompts.js";
```

### 語法驗證

所有修改的檔案都通過語法檢查：

```bash
node -c src/production/production-prompts.js
node -c src/production/artifact-production-service.js
node -c src/cradle-cell.js
node -c src/commands/execution-commands.js
```

## Commit 建議

```bash
git add .

git commit -m "feat(stability): add artifact self-stabilization loop" \
-m "Add execution-feedback artifact repair and stabilize command." \
-m "Allow cells to repeatedly execute, metabolize, repair, and re-execute artifacts until stable." \
-m "Use passed execution with no new repair task as the first stabilization condition."
```

## 影響範圍

這次實作完成後，Cradle v1 的核心已經非常接近完成：

**Cell 不只是會產出 Artifact，而是能反覆修正自己的產物，直到同一類刺激不再產生修復任務。**

這是生物系統的關鍵特性：

- Self-correction（自我修正）
- Homeostasis（穩態）
- Adaptation（適應）

## 程式碼統計

- 新增檔案：1（docs/STABILIZATION_QUICK_START.md）
- 修改檔案：4
- 新增函式：3
- 新增指令：1
- 新增程式碼行數：約 200 行

## 結論

這次實作成功建立了 artifact 自我穩定化機制，讓 Cradle Cell 能夠：

1. 執行產物
2. 感知結果
3. 產生修復任務
4. 修復產物
5. 重新執行
6. 判斷穩定

這是 Cradle Platform 邁向生物系統的重要里程碑。
