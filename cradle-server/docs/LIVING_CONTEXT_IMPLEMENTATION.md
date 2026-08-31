# Living Context 驅動的細胞分裂與融合產物再生

> Current-state document. Last reviewed against source code: 2026-08-31.

## 實作摘要

本次實作完成了「Living Context 驅動的細胞分裂與融合產物再生」的核心功能，遵循以下原則：

1. **Living Context 決定新 Cell 的責任與邊界**
2. **Memory 必須經過 AI 萃取或整合，不可直接整包複製**
3. **Parent Productions 是可選擇的生成素材，不是必須繼承的檔案**
4. **新 Cell 的 Productions 必須重新生成，不可直接複製**
5. **優先順序固定：Living Context > Distilled Memory > Selected Productions**

## 已完成階段

### ✅ 第一階段：建立 Living Context 基礎模型

- `src/living-context/living-context-schema.js` - Living Context 結構定義與驗證
- `src/living-context/living-context-prompts.js` - AI Prompt 建構函式
- `src/living-context/living-context-service.js` - Living Context 服務
- `src/living-context/source-material-service.js` - Source Material 收集服務

### ✅ 第二階段：讓 CradleCell 支援 Living Context

- 修改 `src/cradle-cell.js`
  - 新增 `livingContextFile` 路徑
  - 新增 `prepareLivingContext()` 方法
  - 新增 `readLivingContext()` / `writeLivingContext()` 方法
  - 暴露 `artifactStore` 供其他服務使用
  - 新增 `readProfile()` 別名方法

### ✅ 第三階段：建立 Source Material Service

- 實作 `buildCellSourceMaterial()` - 收集 Cell 的完整資訊
- 實作 `buildArtifactCatalog()` - 建立 Artifact Catalog (只有 metadata)
- 實作 `loadSelectedArtifacts()` - 載入選定的 Artifacts (限制大小)
- 修改 `src/production/artifact-store.js`
  - 新增 `listArtifactSummaries()` 方法
  - 新增 `readArtifacts()` 方法

### ✅ 第四階段：AI 產生 Division Transformation Plan

- 實作 `buildLivingContextDivisionPrompt()` - 建立 Division Prompt
- 實作 `LivingContextService.createDivisionPlan()` - 呼叫 AI 產生計畫
- 包含完整的 normalize 與 validate 流程

### ✅ 第五階段：調整現有 Cell Division

- 修改 `divideTo()` - 移除完整 memory 複製，只建立結構性出生記錄
- 拆分 `divideBySVD()` 為三個方法：
  - `createDivisionPlanBySVD()` - 建立 DNA Division Plan
  - `applyDivisionPlanBySVD()` - 應用 Division Plans
  - `divideBySVD()` - 向後相容的完整流程

### ✅ 第六階段：新增 Artifact Regeneration

- `src/production/artifact-regeneration-service.js`
  - `regenerateForDivision()` - Division 時重新生成 Artifacts
  - `regenerateForFusion()` - Fusion 時重新生成 Artifacts

### ✅ 第七階段：擴充 ArtifactProductionService

- `src/production/artifact-transformation-prompt.js` - Transformation Prompt
- `src/production/artifact-production-transformation.js` - Transformation 生成邏輯
- 修改 `src/production/artifact-production-service.js`
  - 新增 `produceFromTransformation()` 方法
  - 支援 Living Context、Distilled Memory、Source Artifacts

### ✅ 第八階段：Artifact 增加來源資訊

- 修改 `src/production/artifact-schema.js`
  - 新增 `origin` 欄位
  - 支援 `created` / `division` / `fusion` 模式
  - 記錄 `sourceCellIds`、`sourceArtifactIds`、`livingContextId`

### ✅ 第九階段：新增 CellDivisionService

- `src/lifecycle/cell-division-service.js`
  - 整合 DNA Division、Living Context Transformation、Artifact Regeneration
  - 完整的 Division 流程編排
  - 錯誤處理與狀態記錄

### ✅ 第十階段：修改 /divide-svd 命令

- 修改 `src/commands/cell-commands.js`
  - 使用新的 `CellDivisionService`
  - 顯示完整的 Division 資訊
  - 包含 Living Context、Productions、DNA Plan

## 後續完成階段

### ✅ 第十一階段：實作 Fusion

- `src/living-context/living-context-fusion-prompts.js` - Fusion Prompt
- `src/living-context/living-context-fusion-service.js` - Fusion Plan 建立與驗證
- `src/living-context/fusion-plan-schema.js` - Fusion Plan schema、normalize 與 validate
- `src/lifecycle/cell-fusion-service.js` - 多 Parent Cell 融合流程
- `src/commands/fusion-commands.js` - `/fuse` CLI；`/merge` 僅保留為 deprecated alias
- `src/application/fuse-cells-use-case.js` - HTTP API application boundary

### ✅ 第十二階段：新增 Living Context、Division 與 Fusion 測試

目前包含：

- `test/test-living-context-schema.js`
- `test/test-living-context-service.js`
- `test/test-living-context-fusion-service.js`
- `test/test-cell-division-service.js`
- `test/test-cell-division-rollback.js`
- `test/test-cell-fusion-service.js`
- `test/test-division-product-pair-production.js`
- `test/test-fusion-plan-schema.js`
- `test/test-fusion-engine-contract.js`

## 核心設計原則

### Priority Order

所有 Artifact 生成都必須遵循以下優先順序：

1. **Current Goal** (最高優先)
2. **Target Living Context** (定義責任邊界)
3. **Constraints**
4. **Distilled Memory** (知識參考)
5. **Source Artifacts** (參考素材)

### 重要限制

- ❌ 不可破壞現有 `/produce`
- ❌ 不可破壞現有 Artifact Repair
- ❌ 不可直接 copy production directory
- ❌ 不可讓 AI 決定 artifact ID
- ❌ 不可一次把所有 Production 完整內容塞進 Prompt
- ❌ 不可將 Parent 全部 Memory 直接寫入 Child active memory
- ❌ 不可移除 Parent Artifact
- ❌ 不可在 Living Context 規劃失敗時建立 Child

## Current Implementation Boundary

目前已完成 Division 與 Fusion 的主要編排、Living Context plan、Artifact regeneration、來源追蹤、產品關係驗證，以及針對 partial failure 的補償流程。

這不等於已完成全自主演化：

- Lifecycle proposal、policy decision、user approval、operation completion 與 postcondition verification 仍是不同狀態。
- 真實 Provider 的端到端結果仍需要依執行環境驗證，不能只以 fake provider 測試代表模型品質。
- Division 與 Fusion 是結構性操作；自動執行政策不可因功能已存在就默認開啟。
- Living Context 的品質仍需以實際責任邊界、產物關係與後續可執行性判定。

## 使用範例

### Cell Division

```javascript
// 在 CLI 中執行
/divide-svd cell-002

// 或以程式方式使用
import { CellDivisionService } from "./src/lifecycle/cell-division-service.js";

const service = new CellDivisionService();
const result = await service.divide({
  engine,
  parentCell,
  childId: "cell-002"
});

console.log(result.livingContextPlan);
console.log(result.productionResult);
```

### Cell Fusion

```text
/fuse cell-001 cell-002 cell-fused
```

Fusion 會綜合 Parent Cells 的 Living Context 與選定素材，產生新的責任邊界、distilled memory、DNA 與 products；它不是把 Parent 的目錄或 Memory 直接串接。

### 檢視 Living Context

```javascript
const livingContext = await cell.readLivingContext();
console.log(livingContext.purpose);
console.log(livingContext.responsibilities);
console.log(livingContext.excludes);
```

## 下一步

1. 以真實 Provider 驗證 Division/Fusion plan 的語意品質。
2. 驗證生成 products 的實際編譯、執行與 shared contract 相容性。
3. 持續補強 staged Child、Parent revision 與 filesystem compensation 的失敗矩陣。
4. 將 post-apply validation 納入 lifecycle operation 的完成條件。
5. 在明確 opt-in 前維持結構性操作的人工批准與安全政策。

## 檔案結構

```
src/
├── living-context/
│   ├── living-context-schema.js
│   ├── living-context-prompts.js
│   ├── living-context-service.js
│   ├── living-context-fusion-prompts.js
│   ├── living-context-fusion-service.js
│   ├── division-plan-schema.js
│   ├── fusion-plan-schema.js
│   └── source-material-service.js
├── lifecycle/
│   ├── cell-division-service.js
│   ├── cell-division-rollback.js
│   └── cell-fusion-service.js
├── production/
│   ├── artifact-schema.js
│   ├── artifact-store.js
│   ├── artifact-production-service.js
│   ├── artifact-transformation-prompt.js
│   ├── artifact-production-transformation.js
│   ├── artifact-regeneration-service.js
│   └── division-product-pair-production.js
├── commands/
│   ├── division-commands.js
│   └── fusion-commands.js
├── application/
│   ├── divide-cell-use-case.js
│   └── fuse-cells-use-case.js
└── cradle-cell.js (modified)
```
