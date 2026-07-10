/**
 * artifact-regeneration-service.js
 * 
 * Artifact Regeneration Service
 * 負責在 Cell Division/Fusion 時重新生成 Artifacts
 */

import { SourceMaterialService } from "../living-context/source-material-service.js";

export class ArtifactRegenerationService {
  /**
   * 為 Division 重新生成 Artifacts
   * 
   * @param {Object} options
   * @param {Object} options.parentCell - Parent Cell
   * @param {Object} options.childCell - Child Cell
   * @param {Object} options.divisionPlan - Living Context Division Plan
   * @returns {Promise<Object>} { produced, failed, skipped }
   */
  async regenerateForDivision({ parentCell, childCell, divisionPlan }) {
    if (!parentCell) {
      throw new Error("regenerateForDivision: parentCell is required");
    }
    if (!childCell) {
      throw new Error("regenerateForDivision: childCell is required");
    }
    if (!divisionPlan) {
      throw new Error("regenerateForDivision: divisionPlan is required");
    }

    const produced = [];
    const failed = [];
    const skipped = [];

    const productionPlan = divisionPlan.productionPlan || [];

    if (productionPlan.length === 0) {
      return { produced, failed, skipped };
    }

    // 讀取 Child Living Context 與 Memory
    const childLivingContext = divisionPlan.childLivingContext;
    const childMemorySeed = divisionPlan.childMemorySeed || {};

    const distilledMemory = {
      knowledge: childMemorySeed.knowledge || "",
      history: childMemorySeed.history || ""
    };

    // Source Material Service
    const sourceMaterialService = new SourceMaterialService();

    for (const item of productionPlan) {
      try {
        // 載入選定的 Source Artifacts
        const sourceArtifacts = await sourceMaterialService.loadSelectedArtifacts(
          parentCell,
          item.sourceArtifactIds || []
        );

        // 建立 origin 資訊
        const origin = {
          mode: "division",
          sourceCellIds: [parentCell.id],
          sourceArtifactIds: item.sourceArtifactIds || [],
          livingContextId: childLivingContext.id
        };

        // 呼叫 Child Cell 的 Production Service
        const result = await childCell.productionService.produceFromTransformation({
          type: item.type || "code",
          title: item.title,
          goal: item.goal,
          constraints: item.constraints || [],
          livingContext: childLivingContext,
          distilledMemory,
          sourceArtifacts,
          origin
        });

        produced.push({
          artifactId: result.artifact.id,
          type: item.type,
          title: item.title,
          sourceArtifactIds: item.sourceArtifactIds || []
        });

      } catch (error) {
        console.error(`Failed to regenerate artifact: ${item.title}`, error);

        failed.push({
          title: item.title,
          error: error.message,
          sourceArtifactIds: item.sourceArtifactIds || []
        });
      }
    }

    return { produced, failed, skipped };
  }

  /**
   * 為 Fusion 重新生成 Artifacts
   * 
   * @param {Object} options
   * @param {Object[]} options.parentCells - Parent Cells
   * @param {Object} options.childCell - Child Cell (fused)
   * @param {Object} options.fusionPlan - Living Context Fusion Plan
   * @returns {Promise<Object>} { produced, failed, skipped }
   */
  async regenerateForFusion({ parentCells, childCell, fusionPlan }) {
    if (!parentCells || parentCells.length === 0) {
      throw new Error("regenerateForFusion: parentCells is required");
    }
    if (!childCell) {
      throw new Error("regenerateForFusion: childCell is required");
    }
    if (!fusionPlan) {
      throw new Error("regenerateForFusion: fusionPlan is required");
    }

    const produced = [];
    const failed = [];
    const skipped = [];

    const productionPlan = fusionPlan.productionPlan || [];

    if (productionPlan.length === 0) {
      return { produced, failed, skipped };
    }

    // 讀取 Fused Living Context 與 Memory
    const fusedLivingContext = fusionPlan.fusedLivingContext;
    const fusedMemorySeed = fusionPlan.fusedMemorySeed || {};

    const distilledMemory = {
      knowledge: fusedMemorySeed.knowledge || "",
      history: fusedMemorySeed.history || ""
    };

    // Source Material Service
    const sourceMaterialService = new SourceMaterialService();

    for (const item of productionPlan) {
      try {
        // 載入選定的 Source Artifacts (可能來自多個 parent cells)
        const sourceArtifacts = [];

        if (item.sourceArtifacts && Array.isArray(item.sourceArtifacts)) {
          for (const source of item.sourceArtifacts) {
            const parentCell = parentCells.find(cell => cell.id === source.cellId);
            if (parentCell) {
              const artifacts = await sourceMaterialService.loadSelectedArtifacts(
                parentCell,
                [source.artifactId]
              );
              sourceArtifacts.push(...artifacts);
            }
          }
        }

        // 建立 origin 資訊
        const origin = {
          mode: "fusion",
          sourceCellIds: parentCells.map(cell => cell.id),
          sourceArtifactIds: sourceArtifacts.map(a => a.id),
          livingContextId: fusedLivingContext.id
        };

        // 呼叫 Child Cell 的 Production Service
        const result = await childCell.productionService.produceFromTransformation({
          type: item.type || "code",
          title: item.title,
          goal: item.goal,
          constraints: item.constraints || [],
          livingContext: fusedLivingContext,
          distilledMemory,
          sourceArtifacts,
          origin
        });

        produced.push({
          artifactId: result.artifact.id,
          type: item.type,
          title: item.title,
          sourceArtifacts: item.sourceArtifacts || []
        });

      } catch (error) {
        console.error(`Failed to regenerate artifact: ${item.title}`, error);

        failed.push({
          title: item.title,
          error: error.message,
          sourceArtifacts: item.sourceArtifacts || []
        });
      }
    }

    return { produced, failed, skipped };
  }
}
