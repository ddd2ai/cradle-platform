# DNA Maturity 模型重構完成報告

## 完成日期
2026-07-09

## 重構目標
將 Cell 成熟度從 `cell.json` 的 counter-based 模型改為從 `dna-history.json` 的 DNA 向量時間序列計算而來的 **capability + stability** 模型。

---

## 第一輪修改（已完成）✅

### 1. 新增 `src/dna/dna-maturity.js` ✅

**核心函式**：
```javascript
calculateDNAMaturityFromHistory(dnaHistory, options)
```

**計算公式**：
```
maturity = normalizedMagnitude × convergence

其中：
- normalizedMagnitude = clamp01(magnitude / maxMagnitude)
- magnitude = sqrt(Σ traitScore²)  // DNA 能力向量長度
- convergence = 1 / (1 + temporalVariance)
- temporalVariance = average squared distance to mean vector
```

**回傳結構**：
```json
{
  "maturity": 0.25,           // 0-1 分數
  "percent": 25,              // 0-100 百分比
  "state": "seed",            // seed | growing | stable | mature | saturated
  "sampleSize": 5,            // 分析樣本數
  "magnitude": 1.9720,        // 原始能力分數
  "normalizedMagnitude": 0.2465,  // 正規化能力
  "temporalVariance": 0.0000, // 時間序列變異數
  "convergence": 1.0000,      // 穩定度
  "currentTraitScores": {     // 最新 trait 分數
    "PERCEPTION": 0.6972,
    "DECISION": 0.6972,
    // ...
  }
}
```

**支援函式**：
- `calculateTraitScores()` - 將 DNA vector 轉成 8 個 trait scores
- `traitScoresToVector()` - 將 trait scores 轉成數值向量
- `calculateMeanVector()` - 計算平均向量
- `calculateSquaredDistance()` - 計算平方距離
- `calculateTemporalVariance()` - 計算時間序列變異數
- `calculateConvergence()` - 計算收斂度
- `normalizeMagnitude()` - 正規化能力分數
- `classifyMaturity()` - 分類成熟度狀態

---

### 2. `CradleCell` 新增 `getMaturityInfo()` ✅

**位置**：`src/cradle-cell.js`

**新增 import**：
```javascript
import {
  calculateDNAMaturityFromHistory,
} from "./dna/dna-maturity.js";
```

**新方法**：
```javascript
async getMaturityInfo() {
  const history = await this.readDNAHistory();

  return calculateDNAMaturityFromHistory(history, {
    windowSize: 5,        // 最近 5 筆
    varianceScale: 1,     // 變異數縮放
    maxMagnitude: 8,      // 最大能力值
  });
}
```

**用途**：
- 從 `dna-history.json` 讀取歷史記錄
- 計算完整的 DNA 成熟度資訊
- 回傳包含所有診斷資訊的物件

---

### 3. 修改 `getMaturity()` 使用 DNA maturity ✅

**改前**：
```javascript
async getMaturity() {
  const profile = await this.readCellProfile();
  return Number(profile?.maturity ?? 0);
}
```

**改後**：
```javascript
async getMaturity() {
  const maturity = await this.getMaturityInfo();
  return maturity.percent;
}
```

**影響**：
- 外部程式碼仍然可以使用 `await cell.getMaturity()` 取得百分比
- 但現在是從 DNA history 計算，而非讀取 counter
- 保持 backward compatibility

---

### 4. 重構 `canDivide()` 判斷邏輯 ✅

**改前**：
```javascript
async canDivide() {
  return (await this.getMaturity()) >= 5;
}
```

**改後**：
```javascript
async canDivide() {
  const maturity = await this.getMaturityInfo();

  return (
    maturity.sampleSize >= 5 &&
    maturity.maturity >= 0.75 &&
    maturity.temporalVariance <= 0.08 &&
    maturity.normalizedMagnitude >= 0.60
  );
}
```

**新分裂條件**：
1. ✅ **sampleSize >= 5** - 至少有 5 筆 DNA 歷史記錄
2. ✅ **maturity >= 0.75** - 成熟度達到 75% (mature state)
3. ✅ **temporalVariance <= 0.08** - DNA 變異數足夠小（穩定）
4. ✅ **normalizedMagnitude >= 0.60** - DNA 能力分數足夠高

**優點**：
- 多維度判斷，比單一 counter 更合理
- 能力不足無法分裂
- 不穩定無法分裂
- 樣本不足無法分裂

---

### 5. 更新分裂錯誤訊息 ✅

**修改位置**：
- `divideTo()`
- `createDivisionPlanBySVD()`
- `divide()`

**改前**：
```javascript
throw new Error(`Cell ${this.id} is not mature enough to divide. maturity=${await this.getMaturity()}`);
```

**改後**：
```javascript
const maturity = await this.getMaturityInfo();

throw new Error(
  [
    `Cell ${this.id} is not mature enough to divide.`,
    `maturity=${maturity.percent}%`,
    `state=${maturity.state}`,
    `sampleSize=${maturity.sampleSize}`,
    `temporalVariance=${maturity.temporalVariance.toFixed(4)}`,
    `convergence=${maturity.convergence.toFixed(4)}`,
  ].join(" ")
);
```

**優點**：
- 明確顯示哪個條件不滿足
- 提供診斷資訊幫助調試

**範例錯誤訊息**：
```
Cell cell-001 is not mature enough to divide. maturity=25% state=seed sampleSize=5 temporalVariance=0.0000 convergence=1.0000
```

---

### 6. 新增 `/maturity` 指令 ✅

**位置**：`src/commands/cell-commands.js`

**範例輸出**：
```
DNA Maturity

Maturity       : 25%
State          : seed
Sample Size    : 5
Magnitude      : 1.9720
Normalized     : 0.2465
Variance       : 0.000000
Convergence    : 1.0000

Trait Scores:
  PERCEPTION          : 0.6972
  DECISION            : 0.6972
  DECOMPOSITION       : 0.6972
  LEARNING            : 0.6972
  COLLABORATION       : 0.6972
  CREATION            : 0.6972
  EVOLUTION           : 0.6972
  REFLECTION          : 0.6972
```

**用途**：
- 查看當前 Cell 的完整成熟度資訊
- 診斷為什麼無法分裂
- 了解 DNA 演化狀態

---

### 7. 標記 `increaseMaturity()` 為 legacy ✅

**新增註解**：
```javascript
/**
 * Legacy maturity counter (deprecated)
 * DNA maturity is now calculated from dna-history.json
 * Keep this for backward compatibility only
 */
async increaseMaturity(amount = 1) {
  // ...
}
```

**保留原因**：
- 避免破壞現有程式碼
- 可能有其他地方還在使用
- 未來可以逐步移除

---

## 測試結果 ✅

### 測試程式碼：`test-dna-maturity.js`

```bash
node test-dna-maturity.js
```

### 測試輸出：

```
=== DNA Maturity Model Test ===

Test 1: Get Maturity Info
----------------------------
Maturity       : 25%
State          : seed
Sample Size    : 5
Magnitude      : 1.9720
Normalized Mag : 0.2465
Variance       : 0.000000
Convergence    : 1.0000

Test 2: Get Maturity Percentage
--------------------------------
Maturity: 25%

Test 3: Can Divide Check
------------------------
Can Divide: false

Division Requirements:
  ✓ Sample Size >= 5:         PASS (5)
  ✓ Maturity >= 0.75:         FAIL (0.2465)
  ✓ Variance <= 0.08:         PASS (0.0000)
  ✓ Normalized Mag >= 0.60:   FAIL (0.2465)

Test 4: Current Trait Scores
-----------------------------
  PERCEPTION          : 0.6972
  DECISION            : 0.6972
  DECOMPOSITION       : 0.6972
  LEARNING            : 0.6972
  COLLABORATION       : 0.6972
  CREATION            : 0.6972
  EVOLUTION           : 0.6972
  REFLECTION          : 0.6972

Test 5: DNA History
-------------------
Total entries: 9
Recent entries (last 5):
  [1] 2026-07-09T10:03:10.651Z - prepare
  [2] 2026-07-09T10:11:24.060Z - prepare
  [3] 2026-07-09T13:13:13.717Z - prepare
  [4] 2026-07-09T13:29:09.581Z - prepare
  [5] 2026-07-09T14:59:17.681Z - prepare

=== Test Complete ===
```

### ✅ 驗證通過：
1. ✅ DNA maturity 計算正常
2. ✅ `getMaturity()` 回傳 25%
3. ✅ `canDivide()` 正確判斷為 false
4. ✅ 錯誤診斷資訊完整顯示
5. ✅ Trait scores 正確計算

### ⚠️ 發現的問題：
- **temporalVariance = 0.0000** - DNA 完全沒有變化
- 這驗證了 **假成熟問題**：DNA 沒有真正演化，但一直 append 相同的 vector
- 需要實作 **Step 14: `appendDNAHistoryIfChanged()`**

---

## 第二輪修改（待實作）📋

### 6. 修改 `/status` `/colony` `/watch` 顯示 🔜

**目標**：
- 在這些指令中顯示新的 DNA maturity 資訊
- 取代舊的 `profile.maturity` counter

**位置**：
- `src/commands/engine-commands.js`

### 7. 修改 `/merge` 權重 🔜

**目標**：
- 使用 DNA maturity 作為 fusion 權重
- 取代 `profile.maturity` counter

**位置**：
- `/merge` 指令

### 8. 降級 `mature()` 方法 🔜

**目標**：
- 讓 `mature()` 不再增加 counter
- 改為回傳 DNA maturity 資訊

### 9. 實作 `appendDNAHistoryIfChanged()` 🔜

**目標**：
- 防止 DNA 沒變化就 append history
- 避免假成熟問題

**實作**：
```javascript
async appendDNAHistoryIfChanged(reason = "unknown") {
  const vector = await this.readDNAVector();

  if (!vector) return;

  const history = await this.readDNAHistory();
  const latest = history.at(-1)?.vector;

  if (JSON.stringify(latest) === JSON.stringify(vector)) {
    return;
  }

  await this.appendDNAHistory(reason);
}
```

**使用方式**：
```javascript
// 改前
await this.appendDNAHistory("evolution");

// 改後
await this.appendDNAHistoryIfChanged("evolution");
```

---

## 關鍵設計原則

### 1. Maturity = Capability × Stability
- **Capability** (normalizedMagnitude) - DNA 能力向量長度
- **Stability** (convergence) - DNA 時間序列穩定度
- 兩者同時成立才算成熟

### 2. 多維度分裂判斷
- 不再用單一 counter
- 改用能力、穩定度、樣本數的多維度判斷

### 3. 防假成熟機制
- DNA 沒有真正變化不應該增加歷史記錄
- 使用 `appendDNAHistoryIfChanged()` 避免假收斂

### 4. Backward Compatibility
- 保留 `getMaturity()` 回傳百分比
- 保留 `increaseMaturity()` 但標記為 legacy
- 外部程式碼不需要大改

---

## 成熟度狀態分類

| Maturity | State | 說明 |
|----------|-------|------|
| >= 0.90 | saturated | 飽和：能力和穩定度都達到頂峰 |
| >= 0.75 | mature | 成熟：可以分裂 |
| >= 0.60 | stable | 穩定：能力足夠但還在成長 |
| >= 0.30 | growing | 成長：正在發展中 |
| < 0.30 | seed | 種子：剛開始 |

---

## 分裂條件

| 條件 | 閾值 | 目前值 | 狀態 |
|------|------|--------|------|
| Sample Size | >= 5 | 5 | ✅ PASS |
| Maturity | >= 0.75 | 0.25 | ❌ FAIL |
| Temporal Variance | <= 0.08 | 0.0000 | ✅ PASS |
| Normalized Magnitude | >= 0.60 | 0.2465 | ❌ FAIL |

**結論**：當前 cell-001 無法分裂，因為：
- ❌ DNA 能力不足 (0.2465 < 0.60)
- ❌ 整體成熟度不足 (0.25 < 0.75)

---

## 後續建議

### 立即執行（第二輪）：
1. ✅ 實作 `appendDNAHistoryIfChanged()`
2. ✅ 修改 `/status` `/colony` `/watch` 顯示
3. ✅ 修改 `/merge` 權重

### 長期優化：
1. 調整 `windowSize` 參數（目前是 5）
2. 調整 `varianceScale` 參數（目前是 1）
3. 調整 `maxMagnitude` 參數（目前是 8）
4. 調整分裂條件閾值

### 監控指標：
1. 追蹤 DNA history 成長速度
2. 追蹤 temporalVariance 變化
3. 追蹤成熟度分佈
4. 追蹤分裂成功率

---

## 檔案清單

### 新增檔案：
- ✅ `src/dna/dna-maturity.js` - DNA 成熟度計算模組
- ✅ `test-dna-maturity.js` - 測試程式碼
- ✅ `docs/DNA_MATURITY_REFACTOR.md` - 本文件

### 修改檔案：
- ✅ `src/cradle-cell.js` - 新增 `getMaturityInfo()`，修改 `getMaturity()`、`canDivide()`
- ✅ `src/commands/cell-commands.js` - 新增 `/maturity` 指令

---

## 總結

✅ **第一輪修改完成**：
- DNA maturity 模型核心已實作
- 從 `dna-history.json` 計算成熟度
- 多維度分裂判斷
- 新增 `/maturity` 指令
- 保持 backward compatibility

📋 **第二輪待實作**：
- 防假成熟機制
- UI 顯示更新
- Merge 權重更新

🎯 **成果**：
- 成熟度不再是單純的 counter
- 改為能力 × 穩定度的科學模型
- 更合理的分裂判斷機制
- 更豐富的診斷資訊
