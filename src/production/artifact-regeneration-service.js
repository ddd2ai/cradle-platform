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
   * 
   * @param {object} options
   * @param {Array} options.parentCells - Parent Cells
   * @param {object} options.childCell - Child Cell (fused)
   * @param {object} options.fusionPlan - Living Context Fusion Plan
   * @returns {Promise<object>} { produced, failed, skipped, complete }
   */
  async regenerateForFusion({ parentCells, childCell, fusionPlan }) {
    // Validate inputs
    if (!Array.isArray(parentCells) || parentCells.length < 2) {
      throw new Error("regenerateForFusion: parentCells must have at least 2 items");
    }
    
    if (!childCell) {
      throw new Error("regenerateForFusion: childCell is required");
    }
    
    if (!fusionPlan) {
      throw new Error("regenerateForFusion: fusionPlan is required");
    }
    
    if (!Array.isArray(fusionPlan.productionPlan)) {
      throw new Error("fusionPlan.productionPlan must be an array");
    }
    
    if (!childCell.productionService) {
      throw new Error("childCell.productionService is required");
    }

    const productionPlan = fusionPlan.productionPlan;

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
    for (let index = 0; index < productionPlan.length; index++) {
      const item = productionPlan[index];

      try {
        // 依 Parent 分組 Source Artifacts
        const artifactsByParent = this._groupArtifactsByParent(item.sourceArtifacts || []);

        // 載入所有 Parent Artifacts
        const allSourceArtifacts = [];
        const allSourceWarnings = [];

        for (const [parentId, artifactIds] of artifactsByParent.entries()) {
          const parentCell = parentCells.find(cell => cell.id === parentId);

          if (!parentCell) {
            allSourceWarnings.push(`Unknown parent cell: ${parentId}`);
            continue;
          }

          try {
            const sourceResult = await this.sourceMaterialService.loadSelectedArtifacts(
              parentCell,
              artifactIds
            );

            // 為每個 artifact 增加 sourceCellId
            const artifactsWithSource = sourceResult.artifacts.map(artifact => ({
              ...artifact,
              sourceCellId: parentId
            }));

            allSourceArtifacts.push(...artifactsWithSource);

            // 收集 warnings
            sourceResult.errors.forEach(error => {
              allSourceWarnings.push(`${parentId}/${error.artifactId}: ${error.error}`);
            });
          } catch (error) {
            allSourceWarnings.push(`Failed to load artifacts from ${parentId}: ${error.message}`);
          }
        }

        // Call production service with transformation context
        const artifact = await childCell.productionService.produceFromTransformation({
          type: item.type,
          title: item.title,
          goal: item.goal,
          constraints: item.constraints || [],

          livingContext: fusionPlan.fusedLivingContext,
          distilledMemory: fusionPlan.fusedMemorySeed,

          sourceArtifacts: allSourceArtifacts,
          sourceWarnings: allSourceWarnings,

          origin: {
            mode: 'fusion',
            sourceCellIds: parentCells.map(cell => cell.id),
            sourceArtifactIds: (item.sourceArtifacts || []).map(
              source => source.artifactId
            ),
            sourceArtifactRefs: item.sourceArtifacts || [],
            livingContextId: `living-context-${childCell.id}`
          }
        });

        // Record success
        produced.push({
          index,
          title: item.title,
          artifactId: artifact.id,
          sourceArtifactRefs: item.sourceArtifacts || []
        });

      } catch (error) {
        // Record failure but continue with other items
        console.error(`Failed to regenerate artifact: ${item.title}`, error);

        failed.push({
          index,
          title: item.title,
          stage: 'production',
          error: error.message
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
   * 依 Parent 分組 Source Artifacts
   * @private
   */
  _groupArtifactsByParent(sourceArtifacts) {
    const map = new Map();

    for (const source of sourceArtifacts) {
      const cellId = source.cellId;
      const artifactId = source.artifactId;

      if (!cellId || !artifactId) {
        continue;
      }

      if (!map.has(cellId)) {
        map.set(cellId, []);
      }

      map.get(cellId).push(artifactId);
    }

    return map;
  }
}
