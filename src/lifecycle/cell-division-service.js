/**
 * cell-division-service.js
 * 
 * Cell Division Service
 * 整合 DNA Division、Living Context Transformation 與 Artifact Regeneration
 */

import { LivingContextService } from "../living-context/living-context-service.js";
import { SourceMaterialService } from "../living-context/source-material-service.js";
import { ArtifactRegenerationService } from "../production/artifact-regeneration-service.js";

export class CellDivisionService {
  /**
   * 執行完整的 Cell Division 流程
   * 
   * @param {Object} options
   * @param {Object} options.engine - CradleEngine 實例
   * @param {Object} options.parentCell - Parent Cell
   * @param {string} options.childId - Child Cell ID
   * @returns {Promise<Object>} Division result
   */
  async divide({ engine, parentCell, childId }) {
    if (!engine) {
      throw new Error("divide: engine is required");
    }
    if (!parentCell) {
      throw new Error("divide: parentCell is required");
    }
    if (!childId) {
      throw new Error("divide: childId is required");
    }

    // Step 1: 確認 Parent 可以分裂
    await parentCell.assertCanDivide();

    // Step 2: 建立 DNA Division Plan
    console.log(`🧬 Creating DNA division plan...`);
    const dnaPlan = await parentCell.createDivisionPlanBySVD(childId);

    // Step 3: 收集 Parent Source Material
    console.log(`📦 Collecting parent source material...`);
    const sourceMaterialService = new SourceMaterialService();
    const parentSource = await sourceMaterialService.buildCellSourceMaterial(parentCell);

    // Step 4: 建立 Living Context Division Plan (AI Transformation)
    console.log(`🤖 Creating Living Context division plan...`);
    const livingContextService = new LivingContextService({
      requesterCell: parentCell
    });

    let livingContextPlan;
    try {
      livingContextPlan = await livingContextService.createDivisionPlan({
        parentCell,
        childId,
        dnaDivisionPlan: dnaPlan,
        parentSource
      });
    } catch (error) {
      throw new Error(`Living Context division plan failed: ${error.message}`);
    }

    // Step 5: 驗證 Transformation Plan
    console.log(`✅ Validating transformation plan...`);
    // validation 已在 LivingContextService 中完成

    // Step 6: 建立 Child Cell
    console.log(`🐣 Creating child cell: ${childId}...`);
    const child = await engine.createCell(childId);

    // Step 7: 應用 Division Plans
    console.log(`🔄 Applying division plans...`);
    await parentCell.applyDivisionPlanBySVD(child, dnaPlan, livingContextPlan);

    // Step 8: 重新生成 Artifacts
    console.log(`🎨 Regenerating artifacts...`);
    const regenerationService = new ArtifactRegenerationService();

    let productionResult;
    try {
      productionResult = await regenerationService.regenerateForDivision({
        parentCell,
        childCell: child,
        divisionPlan: livingContextPlan
      });
    } catch (error) {
      console.error(`⚠️ Artifact regeneration failed:`, error);
      productionResult = {
        produced: [],
        failed: [{ error: error.message }],
        skipped: []
      };
    }

    // Step 9: 記錄 history / thought
    const complete = productionResult.failed.length === 0;

    if (!complete) {
      await child.appendHistory(`
## ${new Date().toISOString()}

### Production Status

⚠️ Some productions failed during division. Cell is born but production is incomplete.

**Failed Productions**: ${productionResult.failed.length}
**Successful Productions**: ${productionResult.produced.length}
`);

      await child.appendThought(`
## ${new Date().toISOString()}

## Birth Status

I was born from ${parentCell.id}, but some of my planned productions failed.

I am complete as a Cell, but I should review and retry failed productions when possible.
`);
    } else if (productionResult.produced.length > 0) {
      await child.appendHistory(`
## ${new Date().toISOString()}

### Production Status

✅ All planned productions completed successfully.

**Productions**: ${productionResult.produced.length}
`);
    }

    // Step 10: 回傳結果
    return {
      child,
      dnaPlan,
      livingContextPlan,
      productionResult,
      complete
    };
  }
}
