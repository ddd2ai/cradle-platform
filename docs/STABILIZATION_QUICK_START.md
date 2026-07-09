# Artifact Stabilization Quick Start

## 概念

Stabilization 是 Cradle Cell 的自我修復循環機制。

```text
執行 artifact
  ↓
產生 stimulus
  ↓
metabolize 產生 observation & task
  ↓
如果 passed && 無新 task → 穩定
  ↓
否則 repair artifact
  ↓
重新執行
```

## 指令

```bash
/stabilize <artifact-id>
```

## 穩定條件 (第一版)

```javascript
executionResult.status === "passed"
&&
newTasks.length === 0
```

也就是：

- 執行成功
- Cell 不再建立修復任務

## 使用範例

### 測試成功 Artifact

```bash
/use cell-001
/stabilize artifact-test-pass
```

**預期結果：**

```text
Stable   : yes
Rounds   : 1

- Round 1
  executionStatus: passed
  createdTasks   : 0
  tasks          : -
```

### 測試失敗 Artifact

```bash
/stabilize artifact-test-compile-fail
```

**理想情境：**

```text
- Round 1
  executionStatus: compile_failed
  createdTasks   : 1
  tasks          : 驗證 BrokenService.java 編譯失敗原因

- Round 2
  executionStatus: passed
  createdTasks   : 0
  tasks          : -

Stable   : yes
Rounds   : 2
```

**最壞情境：**

```text
- Round 1
  executionStatus: compile_failed
  createdTasks   : 1

- Round 2
  executionStatus: compile_failed
  createdTasks   : 1

- Round 3
  executionStatus: compile_failed
  createdTasks   : 1

Stable   : no
Reason   : max rounds reached
```

## 配置

```javascript
await cell.stabilizeArtifact({
  artifactId: "artifact-xxx",
  maxRounds: 3,  // 預設值
});
```

## 回傳值結構

```javascript
{
  stable: true | false,
  artifactId: "artifact-xxx",
  rounds: 2,
  reason: "max rounds reached" | "execution did not stabilize..." | undefined,
  history: [
    {
      round: 1,
      executionStatus: "compile_failed",
      createdTasks: 1,
      observationFile: "observation-xxx.md",
      newTasks: [
        { id: "task-xxx", title: "修正編譯錯誤" }
      ]
    },
    {
      round: 2,
      executionStatus: "passed",
      createdTasks: 0,
      observationFile: "observation-yyy.md",
      newTasks: []
    }
  ]
}
```

## 流程圖

```text
┌────────────────┐
│ /stabilize     │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Round 1        │
│ Execute        │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Metabolize     │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Check Stable?  │◄──────┐
└───────┬────────┘       │
        │                │
    ┌───┴───┐            │
    │       │            │
    Yes     No           │
    │       │            │
    │       ▼            │
    │  ┌────────────┐    │
    │  │ Repair     │    │
    │  │ Artifact   │    │
    │  └─────┬──────┘    │
    │        │            │
    │        ▼            │
    │  ┌────────────┐    │
    │  │ Round++    │────┘
    │  └────────────┘
    │
    ▼
┌────────────────┐
│ Return Stable  │
└────────────────┘
```

## 內部機制

### Task ID 唯一性

之前可能出現同一秒建立兩個 task，ID 重複：

```text
task-20260709-175918
task-20260709-175918
```

現在已修正為：

```javascript
id: `task-${timestamp}-${randomUUID().slice(0, 8)}`
```

例如：

```text
task-20260709-175918-a3b4c5d6
task-20260709-175918-e7f8g9h0
```

### Repair Prompt

新增 `buildArtifactExecutionRepairPrompt()`，處理 execution feedback：

- 忠實遵守 Original Goal
- 只修正 Task 指出的問題
- 不擴大修改範圍
- 不任務漂移

### Production Service

`ArtifactProductionService` 新增：

```javascript
async repairArtifactFromExecution({
  artifactId,
  task,
  executionResult,
})
```

- 讀取 artifact
- 呼叫 LLM 修復
- 保留原 artifact ID
- 標記 repair note
- 正規化 & 驗證
- 儲存

### Cell Methods

`CradleCell` 新增兩個方法：

1. `repairArtifactFromTask()`
   - 呼叫 production service repair
   - 完成 task

2. `stabilizeArtifact()`
   - 執行多輪循環
   - 追蹤新 task
   - 判斷穩定條件
   - 記錄 history

## 下一步

- Task Dedup (相同問題 → 更新同一個 task)
- Stability Memory (記住哪些 artifact 已穩定)
- DNA Stability Gate (進階穩定判斷)

## 設計原則

1. **不另開巨大架構**
   - 沿用既有 Production / Execution / Metabolize 管線
   - 最小化新增程式碼

2. **反覆測試後趨向穩定**
   - 第一版穩定條件簡單明確
   - 以後可擴充更複雜的判斷

3. **Self Repair Loop**
   - Cell 能自我修正產物
   - 直到同一類刺激不再產生修復任務

4. **忠實於 Original Goal**
   - Repair 不改變原目標
   - 只修正執行問題
