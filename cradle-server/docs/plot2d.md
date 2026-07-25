# DNA Plot 2D 功能說明

## 概述

DNA Plot 2D 是一個將 Cell 的 DNA 向量投影到二維空間的視覺化工具。

這讓你能看到不同 Cell 在 DNA 空間中的相對位置，幫助理解 Cell 之間的特性差異。

## 使用方式

```bash
/plot2d <x軸因子> <y軸因子>
```

### 範例

```bash
# 觀察 Creation 與 Collaboration 的關係
/plot2d CRE COL

# 觀察 Evolution 與 Reflection 的關係
/plot2d EVO REF

# 觀察 Perception 與 Decision 的關係
/plot2d PER DEC
```

## DNA 因子

- **PER** - Perception (感知)
- **DEC** - Decision (決策)
- **DEP** - Decomposition (分解)
- **LEA** - Learning (學習)
- **COL** - Collaboration (協作)
- **CRE** - Creation (創造)
- **EVO** - Evolution (演化)
- **REF** - Reflection (反思)

## 輸出格式

```text
🧬 DNA Plot 2D

X = CRE
Y = COL

COL ↑
1.0 │
0.9 │         🦠 cell-002
0.8 │
0.7 │   🦠 cell-001
0.6 │
0.5 │                🦠 cell-003
0.4 │
0.3 │
0.2 │
0.1 │
0.0 └──────────────────────────────────────────────────→ CRE
    0.0                    0.5                    1.0

Points:
  cell-001     CRE=0.70 COL=0.68
  cell-002     CRE=0.73 COL=0.74
  cell-003     CRE=0.81 COL=0.55
```

## 技術架構

### 模組

1. **dna-projector.js** - DNA 投影邏輯
   - `listDNAFactors()` - 列出所有 DNA 因子
   - `isValidDNAFactor()` - 驗證因子是否有效
   - `projectDNA()` - 將 DNA 向量投影到 2D 空間

2. **render-plot2d.js** - ASCII 圖表渲染
   - 使用 48x12 的畫布
   - 將座標映射到字元位置
   - 繪製軸線和標籤

3. **plot2d-command.js** - 指令處理器
   - 解析使用者輸入
   - 收集所有 Cell 的 DNA 資料
   - 呼叫投影與渲染函式

### DNA 值計算

每個 DNA 因子的值由 `calculateTraitValue()` 計算：

```javascript
value = strength * (fitness / (plasticity / sqrt(stability)))
```

這個公式考慮了：
- **strength** - 該特質的影響力
- **fitness** - 該特質在環境中的有效性
- **plasticity** - 該特質的可塑性
- **stability** - 該特質的穩定性

## 應用場景

1. **觀察 Cell 分化**
   - 看出哪些 Cell 專精於創造
   - 哪些 Cell 專精於協作

2. **偵測 Cell 演化趨勢**
   - 追蹤 Cell 在演化過程中的移動軌跡
   - 觀察是否形成集群或分散

3. **選擇適合的 Cell 執行任務**
   - 需要創新時，選擇 CRE 高的 Cell
   - 需要分析時，選擇 PER 高的 Cell

## 未來擴展

- 支援 3D 投影
- 支援動態追蹤（顯示歷史軌跡）
- 支援標註 Cell 名稱在圖上
- 支援匯出為圖片或 SVG
