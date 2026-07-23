# Living Context 驅動的細胞分裂與融合產物再生

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

## 未完成階段

### ⏳ 第十一階段：實作 Fusion (待後續完成)

需要實作：
- `buildLivingContextFusionPrompt()` in `living-context-prompts.js`
- `CellFusionService` in `src/lifecycle/cell-fusion-service.js`
- 修改 `colony-commands.js` 中的 `/fuse` 命令

### ⏳ 第十二階段：新增測試檔案 (待後續完成)

需要建立：
- `test/test-living-context-schema.js`
- `test/test-living-context-division.js`
- `test/test-artifact-regeneration.js`
- `test/test-living-context-fusion.js`

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

## Commit 計劃

### 第一個 commit (本次實作)

```
feat: add living context model and source material service

- Add Living Context schema, validation, and normalization
- Add Living Context service with AI-driven division plan
- Add Source Material service for collecting cell context
- Extend ArtifactStore with summary and batch read methods
- Modify CradleCell to support Living Context
- Add artifact origin tracking (created/division/fusion)
- Add ArtifactProductionService.produceFromTransformation()
- Add ArtifactRegenerationService for division/fusion
- Add CellDivisionService for orchestrating division process
- Refactor divideTo() and divideBySVD() to use Living Context
- Update /divide-svd command to use CellDivisionService
```

### 第二個 commit (待後續)

```
feat: regenerate child productions during cell division

- Complete end-to-end division with artifact regeneration
- Add comprehensive division tests
- Validate division workflow with real AI calls
```

### 第三個 commit (待未來)

```
feat: synthesize living context and productions during cell fusion

- Add Living Context fusion prompt and service
- Add CellFusionService
- Update /fuse command to use CellFusionService
- Add fusion tests
```

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

### 檢視 Living Context

```javascript
const livingContext = await cell.readLivingContext();
console.log(livingContext.purpose);
console.log(livingContext.responsibilities);
console.log(livingContext.excludes);
```

## 下一步

1. ✅ 測試 `/divide-svd` 命令是否正常運作
2. ✅ 驗證 Living Context 是否正確建立
3. ✅ 驗證 Artifact 是否正確重新生成
4. ⏳ 實作 Fusion 功能
5. ⏳ 新增完整測試覆蓋
6. ⏳ 更新文件與範例

## 檔案結構

```
src/
├── living-context/
│   ├── living-context-schema.js
│   ├── living-context-prompts.js
│   ├── living-context-service.js
│   └── source-material-service.js
├── lifecycle/
│   └── cell-division-service.js
├── production/
│   ├── artifact-schema.js (modified)
│   ├── artifact-store.js (modified)
│   ├── artifact-production-service.js (modified)
│   ├── artifact-transformation-prompt.js (new)
│   ├── artifact-production-transformation.js (new)
│   └── artifact-regeneration-service.js (new)
├── commands/
│   └── cell-commands.js (modified)
└── cradle-cell.js (modified)
```
