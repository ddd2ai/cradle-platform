/**
 * artifact-regeneration-service.js
 * 
 * Artifact Regeneration Service
 * 負責在 Cell Division/Fusion 時重新生成 Artifacts
 */

import { SourceMaterialService } from "../living-context/source-material-service.js";

export class ArtifactRegenerationService {
  constructor({
    sourceMaterialService
  } = {}) {
    this.sourceMaterialService = 
      sourceMaterialService ?? 
      new SourceMaterialService();
  }

  /**
   * 為 Division 重新生成 Artifacts
   * 
   * @param {Object} options
   * @param {Object} options.parentCell - Parent Cell
   * @param {Object} options.childCell - Child Cell
   * @param {Object} options.divisionPlan - Living Context Division Plan
   * @returns {Promise<Object>} { produced, failed, skipped, complete }
   */
  async regenerateForDivision({ parentCell, childCell, divisionPlan }) {
    // Validate inputs
    if (!parentCell) {
      throw new Error("regenerateForDivision: parentCell is required");
    }
    if (!childCell) {
      throw new Error("regenerateForDivision: childCell is required");
    }
    if (!divisionPlan) {
      throw new Error("regenerateForDivision: divisionPlan is required");
    }
    if (!Array.isArray(divisionPlan.productionPlan)) {
      throw new Error("divisionPlan.productionPlan must be an array");
    }
    if (!childCell.productionService) {
      throw new Error("childCell.productionService is required");
    }

    const productionPlan = divisionPlan.productionPlan;

    // Empty production plan is valid, not an error
    if (productionPlan.length === 0) {
      return { 
        produced: [], 
        failed: [], 
        skipped: [],
        complete: true 
      };
    }

    const produced = [];
    const failed = [];
    const skipped = [];

    // Process each production item sequentially
    // (avoid provider listener conflicts, ID collisions, prompt overload)
    for (let index = 0; index < productionPlan.length; index++) {
      const item = productionPlan[index];

      try {
        // Load source artifacts
        const sourceResult = await this.sourceMaterialService.loadSelectedArtifacts(
          parentCell,
          item.sourceArtifactIds || []
        );

        // Collect source warnings from errors
        const sourceWarnings = sourceResult.errors.map(
          error => `${error.artifactId}: ${error.error}`
        );

        // Call production service with transformation context
        const artifact = await childCell.productionService.produceFromTransformation({
          type: item.type,
          title: item.title,
          goal: item.goal,
          constraints: item.constraints || [],

          livingContext: divisionPlan.childLivingContext,
          distilledMemory: divisionPlan.childMemorySeed,

          sourceArtifacts: sourceResult.artifacts,
          sourceWarnings,

          origin: {
            mode: 'division',
            sourceCellIds: [parentCell.id],
            sourceArtifactIds: item.sourceArtifactIds || [],
            livingContextId: `living-context-${childCell.id}`
          }
        });

        // Record success
        produced.push({
          index,
          title: item.title,
          artifactId: artifact.id,
          sourceArtifactIds: item.sourceArtifactIds || []
        });

      } catch (error) {
        // Record failure but continue with other items
        console.error(`Failed to regenerate artifact: ${item.title}`, error);

        failed.push({
          index,
          title: item.title,
          stage: 'production',
          message: error.message
        });
      }
    }

    return { 
      produced, 
      failed, 
      skipped,
      complete: failed.length === 0
    };
  }

  /**
   * 為 Fusion 重新生成 Artifacts
   * (暫未完整實作)
   * 
   * @param {Object} options
   * @param {Object[]} options.parentCells - Parent Cells
   * @param {Object} options.childCell - Child Cell (fused)
   * @param {Object} options.fusionPlan - Living Context Fusion Plan
   * @returns {Promise<Object>} { produced, failed, skipped, complete }
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

    // 暫時不實作 Fusion Regeneration
    return { 
      produced: [], 
      failed: [], 
      skipped: [],
      complete: true 
    };
  }
}
