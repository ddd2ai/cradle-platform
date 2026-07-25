# Stability Memory Quick Reference

## 核心概念

```text
單次成功 ≠ 真正穩定
連續穩定 = 真正穩定
```

## 穩定條件

### 第一版（舊）

```javascript
passed + no task = stable
```

### 第二版（新）

```javascript
consecutivePassed >= 2 && consecutiveNoTask >= 2 = stable
```

## 指令

### 執行穩定化

```bash
/stabilize <artifact-id>
```

自動執行、感知、修復，直到穩定或達到最大輪數。

### 查看穩定狀態

```bash
/stability <artifact-id>
```

顯示穩定狀態、連續次數、修復次數、歷史記錄。

## 狀態

| Status | 說明 |
|--------|------|
| `unstable` | 初始狀態或剛失敗 |
| `stabilizing` | 正在穩定中（已有部分成功） |
| `stable` | 連續 2 次 passed + 2 次 no task |

## 資料結構

```javascript
{
  "artifactId": "artifact-xxx",
  "status": "stable",
  "consecutivePassed": 2,      // 連續成功次數
  "consecutiveNoTask": 2,      // 連續無新 task 次數
  "repairCount": 1,            // 總修復次數
  "stableAt": "2026-07-09T...", // 達到穩定時間
  "updatedAt": "2026-07-09T...",
  "records": [...]              // 歷史記錄
}
```

## 計數規則

### consecutivePassed

```javascript
if (executionStatus === "passed") {
  consecutivePassed += 1;
} else {
  consecutivePassed = 0;  // 失敗就歸零
}
```

### consecutiveNoTask

```javascript
if (createdTasks === 0) {
  consecutiveNoTask += 1;
} else {
  consecutiveNoTask = 0;  // 有新 task 就歸零
  repairCount += createdTasks;
}
```

## 檔案位置

```text
cells/cell-001/stability.json
```

## API

```javascript
// 取得狀態
const state = await cell.stabilityStore.getArtifactState(artifactId);

// 新增記錄
const state = await cell.stabilityStore.appendArtifactRecord(artifactId, {
  round,
  executionStatus,
  createdTasks,
  observationFile,
  tasks,
});
```

## Issue Fingerprint

```javascript
import { createIssueFingerprint } from "./stability/issue-fingerprint.js";

const fingerprint = createIssueFingerprint({
  artifactId,
  executionResult,
});
// → "a3b4c5d6e7f8g9h0" (16 chars)
```

用途：識別相同問題，避免重複建立 task（下一步實作）。

## 測試流程

```bash
# 1. 執行穩定化
/stabilize artifact-xxx

# 2. 查看狀態
/stability artifact-xxx
# 看到 consecutivePassed: 1, status: stabilizing

# 3. 再次執行
/stabilize artifact-xxx

# 4. 再次查看
/stability artifact-xxx
# 看到 consecutivePassed: 2, status: stable ✅
```

## 狀態轉換圖

```text
unstable
  ↓ (passed + no task)
stabilizing (1x)
  ↓ (passed + no task)
stable (2x) ✅
  ↓ (failed or has task)
stabilizing (0x, 重新計數)
```

## 進度

```text
✅ Self Repair Loop        100%
✅ Self Stabilization      100%
✅ Stability Memory         80%  ← 現在
⬜ Issue Dedup              30%  ← 下一步
⬜ Stable Gate              20%
⬜ Division/Fusion           0%
```

## 下一步

1. **Task Dedup** - 同類問題不重複產生 task
2. **Stable Gate** - 只有穩定的 cell 才能分裂
3. **Division/Fusion** - 細胞分裂與融合機制

## 關鍵改進

| 項目 | 第一版 | 第二版 |
|------|--------|--------|
| 判斷標準 | 單次成功 | 連續 2 次成功 |
| 記憶能力 | 無 | 有完整歷史 |
| 狀態追蹤 | 無 | unstable/stabilizing/stable |
| 修復計數 | 無 | 有 repairCount |
| 問題指紋 | 無 | 有 createIssueFingerprint |

---

**連續穩定 > 單次成功** 🎯✨
