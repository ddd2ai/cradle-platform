/**
 * cell-fusion-service.js
 * 
 * Cell Fusion Service
 * 整合 DNA Fusion 與 Living Context Fusion
 * 重用現有 Production Pipeline
 */

import path from "path";
import fs from "fs/promises";
import { LivingContextFusionService } from "../living-context/living-context-fusion-service.js";
import { ArtifactRegenerationService } from "../production/artifact-regeneration-service.js";
import { createLivingContext, normalizeLivingContext } from "../living-context/living-context-schema.js";

export class CellFusionService {
  /**
   * @param {object} options
   * @param {Function} [options.livingContextFusionServiceFactory] - Factory for LivingContextFusionService
   * @param {object} [options.artifactRegenerationService] - Artifact Regeneration Service
   */
  constructor({
    livingContextFusionServiceFactory,
    artifactRegenerationService
  } = {}) {
    this.livingContextFusionServiceFactory = livingContextFusionServiceFactory || ((requesterCell) => {
      return new LivingContextFusionService({ requesterCell });
    });

    this.artifactRegenerationService = 
      artifactRegenerationService ?? 
      new ArtifactRegenerationService();
  }

  /**
   * 執行完整的 Cell Fusion
   * 
   * @param {object} options
   * @param {object} options.engine - Cradle Engine
   * @param {Array} options.parentCells - Parent Cell 陣列
   * @param {string} options.childId - Child Cell ID
   * @returns {Promise<object>} Fusion result
   */
  async fuse({ engine, parentCells, childId }) {
    // 1. Validate
    this._validateParameters({ engine, parentCells, childId });

    // 2. 確認 Child 不存在
    if (this._childExists(engine, childId)) {
      throw new Error(`CellFusionService: child cell already exists: ${childId}`);
    }

    // ===== Planning Phase =====

    let dnaFusionPlan;
    let fusionPlan;

    try {
      // 3. createFusionPlanByDNA()
      console.log(`  Planning DNA fusion...`);
      const firstParent = parentCells[0];
      
      dnaFusionPlan = await firstParent.createFusionPlanByDNA({
        parentCells,
        childId
      });

      // 4. createFusionPlan()
      console.log(`  Planning Living Context fusion...`);
      const fusionService = this.livingContextFusionServiceFactory(firstParent);
      
      fusionPlan = await fusionService.createFusionPlan({
        parentCells,
        childId,
        dnaFusionPlan
      });

      console.log(`  ✅ Planning phase complete`);
    } catch (error) {
      // Planning 失敗：不可建立 Child
      throw new Error(`CellFusionService: planning failed: ${error.message}`, {
        cause: error
      });
    }

    // ===== Application Phase =====

    let child;
    const errors = [];

    try {
      // 6. engine.createCell(childId)
      console.log(`  Creating child cell...`);
      child = await engine.createCell(childId);

      // 7. applyFusionPlanByDNA()
      console.log(`  Applying DNA fusion...`);
      try {
        const firstParent = parentCells[0];
        await firstParent.applyFusionPlanByDNA({
          childCell: child,
          parentCells,
          dnaFusionPlan
        });
      } catch (error) {
        errors.push({
          stage: "apply-dna",
          message: error.message
        });
        throw error;
      }

      // 8. apply fused Living Context
      console.log(`  Applying Living Context fusion...`);
      try {
        await this._applyFusedLivingContext({
          parentCells,
          childCell: child,
          fusionPlan
        });
      } catch (error) {
        errors.push({
          stage: "apply-living-context",
          message: error.message
        });
        throw error;
      }

      // 9. apply fused Memory Seed
      console.log(`  Applying fused memory...`);
      try {
        await this._applyFusedMemory({
          parentCells,
          childCell: child,
          fusionPlan
        });
      } catch (error) {
        errors.push({
          stage: "apply-memory",
          message: error.message
        });
        throw error;
      }

      // 12. archive Parent memory snapshots
      console.log(`  Archiving parent memories...`);
      try {
        await this._archiveParentMemories({
          parentCells,
          childCell: child
        });
      } catch (error) {
        // Archive 錯誤不阻止 Fusion
        console.warn(`  ⚠️  Memory archive warning: ${error.message}`);
      }

      // 11. create relationships
      console.log(`  Creating relationships...`);
      try {
        await this._createRelationships({
          parentCells,
          childCell: child,
          fusionPlan
        });
      } catch (error) {
        errors.push({
          stage: "relationships",
          message: error.message
        });
        throw error;
      }

      // 13. regenerate productions
      console.log(`  Regenerating productions...`);
      let productionResult = {
        produced: [],
        failed: [],
        skipped: [],
        complete: true
      };

      try {
        productionResult = await this.artifactRegenerationService.regenerateForFusion({
          parentCells,
          childCell: child,
          fusionPlan
        });

        if (productionResult.produced.length > 0) {
          console.log(`  ✅ Produced ${productionResult.produced.length} artifact(s)`);
        }

        if (productionResult.failed.length > 0) {
          console.log(`  ⚠️  ${productionResult.failed.length} artifact(s) failed`);
        }

        // 14. write history / thoughts
        await this._recordFusionHistory(parentCells, child, productionResult);

      } catch (error) {
        errors.push({
          stage: "production",
          message: error.message
        });

        // Production 失敗時 Child 保留
        console.warn(`  ⚠️  Production incomplete`);
      }

      // 15. return result
      const complete = errors.length === 0 && productionResult.complete;

      return {
        success: true,
        child,
        complete,
        errors,
        productionResult,
        fusionPlan
      };

    } catch (error) {
      // Application 失敗：Child 保留，complete = false
      if (child) {
        await this._recordIncompleteHistory(child, errors);
      }

      return {
        success: false,
        child,
        complete: false,
        errors,
        error: error.message
      };
    }
  }

  /**
   * 驗證參數
   */
  _validateParameters({ engine, parentCells, childId }) {
    if (!engine) {
      throw new Error("CellFusionService: engine is required");
    }

    if (!Array.isArray(parentCells) || parentCells.length < 2) {
      throw new Error("CellFusionService: parentCells must have at least 2 items");
    }

    if (!childId || typeof childId !== "string") {
      throw new Error("CellFusionService: childId must be a non-empty string");
    }

    // 驗證 Parent IDs 不重複
    const parentIds = parentCells.map(cell => cell.id);
    const uniqueIds = new Set(parentIds);

    if (uniqueIds.size !== parentIds.length) {
      throw new Error("CellFusionService: parentCells must not contain duplicate IDs");
    }

    // 驗證 childId 不在 parentIds 中
    if (parentIds.includes(childId)) {
      throw new Error("CellFusionService: childId must not be the same as any parent ID");
    }
  }

  /**
   * 檢查 Child 是否已存在
   */
  _childExists(engine, childId) {
    const cells = engine.listCells();
    return cells.some(cell => cell.id === childId);
  }

  /**
   * 套用 Fused Living Context
   */
  async _applyFusedLivingContext({ parentCells, childCell, fusionPlan }) {
    // 寫入 Living Context
    const childContext = createLivingContext({
      ...fusionPlan.fusedLivingContext,
      cellId: childCell.id
    });

    await childCell.writeLivingContext(childContext);

    // 同步 Responsibilities
    const responsibilities = fusionPlan.fusedLivingContext.responsibilities || [];
    await childCell.setResponsibilities(responsibilities);
  }

  /**
   * 套用 Fused Memory
   */
  async _applyFusedMemory({ parentCells, childCell, fusionPlan }) {
    const seed = fusionPlan.fusedMemorySeed || {};

    // Child Identity
    const parentList = parentCells.map(cell => `- ${cell.id}`).join("\n");
    
    const identity = `# Identity

I am ${childCell.id}.

I was formed through fusion of:
${parentList}

My unified responsibility is defined by my Living Context.
`;

    await childCell.writeMemory("identity", identity);

    // Child Knowledge
    if (seed.knowledge) {
      const knowledge = `# Knowledge

${seed.knowledge}
`;
      
      await childCell.writeMemory("knowledge", knowledge);
    }

    // Child History
    const purpose = fusionPlan.fusedLivingContext.purpose || "";
    const responsibilities = (fusionPlan.fusedLivingContext.responsibilities || [])
      .map(r => `- ${r}`)
      .join("\n");

    const history = `# History

## Birth by Cell Fusion

Parents:
${parentList}

Purpose:
${purpose}

Responsibilities:
${responsibilities}
`;

    await childCell.writeMemory("history", history);

    // Child Thought
    let thought = `I emerged from the fusion of ${parentCells.map(c => c.id).join(" and ")}.`;

    if (seed.thought) {
      thought += `\n\n${seed.thought}`;
    }

    await childCell.writeMemory("thoughts", thought);
  }

  /**
   * Archive Parent Memory
   */
  async _archiveParentMemories({ parentCells, childCell }) {
    const archiveDir = path.join(childCell.memoryDir, "archive");

    for (const parent of parentCells) {
      const parentArchiveDir = path.join(archiveDir, parent.id);

      try {
        await fs.mkdir(parentArchiveDir, { recursive: true });

        // Archive 每個 Memory 檔案
        const memoryFiles = ["identity.md", "knowledge.md", "history.md", "thoughts.md"];

        for (const fileName of memoryFiles) {
          try {
            const sourceFile = path.join(parent.memoryDir, fileName);
            const targetFile = path.join(parentArchiveDir, fileName);

            const content = await fs.readFile(sourceFile, "utf8");
            await fs.writeFile(targetFile, content, "utf8");
          } catch (error) {
            // 單一檔案不存在時跳過
            if (error.code !== "ENOENT") {
              console.warn(`  ⚠️  Failed to archive ${fileName} from ${parent.id}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        // Archive 錯誤記錄 warning，不阻止 Fusion
        console.warn(`  ⚠️  Failed to archive memories from ${parent.id}: ${error.message}`);
      }
    }
  }

  /**
   * 建立 Relationships
   */
  async _createRelationships({ parentCells, childCell, fusionPlan }) {
    // 每個 Parent: fused-into
    for (const parent of parentCells) {
      try {
        await parent.addRelationship({
          type: "fused-into",
          target: childCell.id
        });
      } catch (error) {
        console.warn(`  ⚠️  Failed to add fused-into relationship for ${parent.id}: ${error.message}`);
      }
    }

    // Child: fused-from for each parent
    for (const parent of parentCells) {
      await childCell.addRelationship({
        type: "fused-from",
        target: parent.id
      });
    }

    // 加入 Fusion Plan 的 relationships (去重)
    const planRelationships = fusionPlan.fusedLivingContext.relationships || [];
    const existingKeys = new Set();

    // 先收集已有的 relationships
    const existing = await childCell.getRelationships();
    for (const rel of existing) {
      existingKeys.add(`${rel.type}:${rel.target}`);
    }

    // 加入新的 relationships
    for (const rel of planRelationships) {
      const key = `${rel.type}:${rel.target}`;
      
      if (!existingKeys.has(key)) {
        await childCell.addRelationship(rel);
        existingKeys.add(key);
      }
    }
  }

  /**
   * 記錄 Fusion History
   */
  async _recordFusionHistory(parentCells, child, productionResult) {
    const parentIds = parentCells.map(cell => cell.id).join(", ");

    let historyEntry = `## Cell Fusion

Fused from: ${parentIds}
Complete: ${productionResult.complete ? "yes" : "no"}
`;

    if (productionResult.produced.length > 0) {
      historyEntry += `\nProduced:\n`;
      productionResult.produced.forEach(artifact => {
        historyEntry += `- ${artifact.id}\n`;
      });
    }

    if (productionResult.failed.length > 0) {
      historyEntry += `\nFailed:\n`;
      productionResult.failed.forEach(failure => {
        historyEntry += `- ${failure.title}: ${failure.error}\n`;
      });
    }

    await child.appendHistory(historyEntry);

    // Thought
    let thought = `I have completed fusion from ${parentIds}.`;

    if (!productionResult.complete) {
      thought = `My fusion from ${parentIds} is incomplete. Some productions failed.`;
    }

    await child.think(thought);
  }

  /**
   * 記錄 Incomplete History
   */
  async _recordIncompleteHistory(child, errors) {
    const errorList = errors.map(err => `- ${err.stage}: ${err.message}`).join("\n");

    const historyEntry = `## Incomplete Cell Fusion

Status: incomplete
Errors:
${errorList}
`;

    try {
      await child.appendHistory(historyEntry);
    } catch (error) {
      console.warn(`  ⚠️  Failed to record incomplete history: ${error.message}`);
    }
  }
}
