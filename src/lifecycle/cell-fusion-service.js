/**
 * cell-fusion-service.js
 * 
 * Cell Fusion Service
 * 整合 DNA Fusion 與 Living Context Fusion
 * 實作 Plan-Apply 分離架構
 */

import path from "path";
import fs from "fs/promises";
import {
  DNAFusionService,
} from "../dna/dna-fusion-service.js";
import {
  LivingContextFusionService,
} from "../living-context/living-context-fusion-service.js";
import {
  createLivingContext,
  normalizeLivingContext,
} from "../living-context/living-context-schema.js";
import { ArtifactRegenerationService } from "../production/artifact-regeneration-service.js";
import { block } from "../utils/text.js";

export class CellFusionService {
  /**
   * @param {Object} options
   * @param {Object} [options.dnaFusionService] - DNA Fusion Service
   * @param {Function} [options.livingContextFusionServiceFactory] - Factory for LivingContextFusionService
   * @param {Object} [options.artifactRegenerationService] - Artifact Regeneration Service
   */
  constructor({
    dnaFusionService,
    livingContextFusionServiceFactory,
    artifactRegenerationService,
  } = {}) {
    this.dnaFusionService =
      dnaFusionService ??
      new DNAFusionService();

    this.livingContextFusionServiceFactory =
      livingContextFusionServiceFactory ??
      ((requesterCell) =>
        new LivingContextFusionService({
          requesterCell,
        }));

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
    this._validateParameters({ engine, parentCells, childId });

    if (this._childExists(engine, childId)) {
      throw new Error(`CellFusionService: child cell already exists: ${childId}`);
    }

    const { dnaFusionPlan, fusionPlan } =
      await this._createFusionPlans({
        parentCells,
        childId,
      });

    let child;
    const errors = [];

    try {
      console.log(`  Creating child cell...`);
      child = await engine.createCell(childId);

      await this._runApplicationStage(errors, "apply-dna", async () => {
        console.log(`  Applying DNA fusion...`);
        await this.dnaFusionService.applyPlan({
          childCell: child,
          parentCells,
          plan: dnaFusionPlan
        });
      });

      await this._runApplicationStage(errors, "apply-living-context", async () => {
        console.log(`  Applying Living Context fusion...`);
        await this._applyFusedLivingContext({
          parentCells,
          childCell: child,
          fusionPlan
        });
      });

      await this._runApplicationStage(errors, "apply-memory", async () => {
        console.log(`  Applying fused memory...`);
        await this._applyFusedMemory({
          parentCells,
          childCell: child,
          fusionPlan
        });
      });

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

      await this._runApplicationStage(errors, "relationships", async () => {
        console.log(`  Creating relationships...`);
        await this._createRelationships({
          parentCells,
          childCell: child,
          fusionPlan
        });
      });

      const productionResult =
        await this._regenerateProductions({
          parentCells,
          child,
          fusionPlan,
          errors,
        });

      await this._recordFusionHistory({
        parentCells,
        child,
        fusionPlan,
        productionResult
      });

      return this._createFusionResult({
        child,
        errors,
        productionResult,
        dnaFusionPlan,
        fusionPlan
      });

    } catch (error) {
      // Application 失敗：Child 保留，complete = false
      if (child) {
        await this._recordIncompleteHistory(parentCells, child, errors);
      }

      const status = child ? "incomplete" : "failed";

      return {
        success: false,
        status,
        child,
        complete: false,
        errors,
        error: error.message
      };
    }
  }

  async _createFusionPlans({ parentCells, childId }) {
    try {
      console.log(`  Planning DNA fusion...`);

      const dnaFusionPlan = await this.dnaFusionService.createPlan({
        parentCells,
        childId
      });

      console.log(`  Planning Living Context fusion...`);
      const firstParent = parentCells[0];
      const fusionService = this.livingContextFusionServiceFactory(firstParent);

      const fusionPlan = await fusionService.createFusionPlan({
        parentCells,
        childId,
        dnaFusionPlan
      });

      console.log(`  ✅ Planning phase complete`);

      return {
        dnaFusionPlan,
        fusionPlan,
      };
    } catch (error) {
      // Planning 失敗：不可建立 Child
      throw new Error(`CellFusionService: planning failed: ${error.message}`, {
        cause: error
      });
    }
  }

  async _runApplicationStage(errors, stage, callback) {
    try {
      await callback();
    } catch (error) {
      errors.push({
        stage,
        message: error.message
      });
      throw error;
    }
  }

  async _regenerateProductions({ parentCells, child, fusionPlan, errors }) {
    console.log(`  Regenerating productions...`);

    const defaultProductionResult = {
      produced: [],
      failed: [],
      skipped: [],
      complete: true
    };

    try {
      const productionResult =
        await this.artifactRegenerationService.regenerateForFusion({
          parentCells,
          childCell: child,
          fusionPlan
        });

      this._logProductionResult(productionResult);
      return productionResult;
    } catch (error) {
      errors.push({
        stage: "production",
        message: error.message
      });

      // Production 失敗時 Child 保留
      console.warn(`  ⚠️  Production incomplete`);
      return defaultProductionResult;
    }
  }

  _logProductionResult(productionResult) {
    if (productionResult.produced.length > 0) {
      console.log(`  ✅ Produced ${productionResult.produced.length} artifact(s)`);
    }

    if (productionResult.failed.length > 0) {
      console.log(`  ⚠️  ${productionResult.failed.length} artifact(s) failed`);
    }
  }

  _createFusionResult({
    child,
    errors,
    productionResult,
    dnaFusionPlan,
    fusionPlan,
  }) {
    const complete = errors.length === 0 && productionResult.complete;
    const status = complete ? "complete" : (child ? "incomplete" : "failed");

    return {
      success: status !== "failed",
      status,
      child,
      complete,
      errors,
      productionResult,
      dnaFusionPlan,
      fusionPlan
    };
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
    return engine.cells.has(childId);
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
    const parentIds = parentCells.map(cell => cell.id);
    const parentList = parentIds.map(id => `- ${id}`).join("\n");
    
    // 1. Child Identity
    const identity = block([
      "# Identity",
      "",
      `I am ${childCell.id}.`,
      "",
      "I was formed through fusion of:",
      parentList,
      "",
      "My unified responsibility is defined by my Living Context.",
      "",
    ]);

    await childCell.writeMemory("identity", identity);

    // 2. Child Knowledge (從 fusedMemorySeed)
    const knowledge = block([
      "# Knowledge",
      "",
      seed.knowledge ?? "",
      "",
    ]);
      
    await childCell.writeMemory("knowledge", knowledge);

    // 3. Child History (基本出生記錄)
    const purpose = fusionPlan.fusedLivingContext.purpose || "";
    
    const history = block([
      "# History",
      "",
      "## Birth by Cell Fusion",
      "",
      "Parents:",
      parentList,
      "",
      `Purpose: ${purpose}`,
      "",
    ]);

    await childCell.writeMemory("history", history);

    // 4. Child Thought (如果有)
    if (
      typeof seed.thought === "string" &&
      seed.thought.trim() !== ""
    ) {
      await childCell.appendThought(
        seed.thought.trim()
      );
    }
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
        const archiveFiles = [
          {
            name: "identity.md",
            source: parent.memoryFiles.identity,
          },
          {
            name: "rules.md",
            source: parent.memoryFiles.rules,
          },
          {
            name: "knowledge.md",
            source: parent.memoryFiles.knowledge,
          },
          {
            name: "history.md",
            source: parent.memoryFiles.history,
          },
          {
            name: "thoughts.md",
            source: path.join(parent.thoughtsDir, "thoughts.md"),
          },
        ];

        for (const archiveFile of archiveFiles) {
          try {
            const content = await fs.readFile(archiveFile.source, "utf8");
            await fs.writeFile(
              path.join(parentArchiveDir, archiveFile.name),
              content,
              "utf8"
            );
          } catch (error) {
            // 單一檔案不存在時跳過
            if (error.code !== "ENOENT") {
              console.warn(`  ⚠️  Failed to archive ${archiveFile.name} from ${parent.id}: ${error.message}`);
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
    // 1. Parent -> Child (fused-into)
    for (const parent of parentCells) {
      await parent.addRelationship(
        "fused-into",
        childCell.id
      );
    }

    // 2. Child -> Parents (fused-from)
    for (const parent of parentCells) {
      await childCell.addRelationship(
        "fused-from",
        parent.id
      );
    }

    // 3. Living Context 中的其他 relationships
    const relationships =
      fusionPlan
        .fusedLivingContext
        .relationships ?? [];

    for (
      const relationship of relationships
    ) {
      // 檢查是否已存在（避免重複）
      const existing = await childCell.listRelationships();
      const isDuplicate = existing.some(
        r =>
          r.type === relationship.type &&
          r.target === relationship.target
      );

      if (!isDuplicate) {
        await childCell.addRelationship(
          relationship.type,
          relationship.target
        );
      }
    }
  }

  /**
   * 記錄 Fusion History
   */
  async _recordFusionHistory({ parentCells, child, fusionPlan, productionResult }) {
    const parentIds = parentCells.map(cell => cell.id);
    const parentList = parentIds.join(", ");
    const purpose = fusionPlan?.fusedLivingContext?.purpose || "(not recorded)";

    // 1. Parent History 與 Thought
    for (const parent of parentCells) {
      await parent.appendHistory(
        block([
          `## Cell Fusion`,
          "",
          `Fused into: ${child.id}`,
          "Parents:",
          ...parentIds.map(id => `- ${id}`),
          `Purpose: ${purpose}`,
          "",
        ])
      );

      await parent.appendThought(
        block([
          `## ${new Date().toISOString()}`,
          "",
          `I fused with ${parentIds.filter(id => id !== parent.id).join(", ")} to create ${child.id}.`,
          "",
        ])
      );
    }

    // 2. Child History (已在 _applyFusedMemory 中建立，這裡追加 production 結果)
    const productionSummary = [];
    
    productionSummary.push("## Fusion Production");
    productionSummary.push("");
    productionSummary.push(`Complete: ${productionResult.complete ? "yes" : "no"}`);
    productionSummary.push("");

    if (productionResult.produced && productionResult.produced.length > 0) {
      productionSummary.push("Produced:");
      productionResult.produced.forEach(artifact => {
        productionSummary.push(`- ${artifact.id}`);
      });
      productionSummary.push("");
    }

    if (productionResult.failed && productionResult.failed.length > 0) {
      productionSummary.push("Failed:");
      productionResult.failed.forEach(failure => {
        productionSummary.push(`- ${failure.title}: ${failure.error}`);
      });
      productionSummary.push("");
    }

    await child.appendHistory(
      block(productionSummary)
    );

    // 3. Child Thought
    const thoughtLines = [
      `## ${new Date().toISOString()}`,
      "",
      "## Birth by Cell Fusion",
      "",
      "Parents:",
      ...parentIds.map(id => `- ${id}`),
      "",
    ];

    if (productionResult.complete) {
      thoughtLines.push(`I have completed fusion from ${parentList}.`);
    } else {
      thoughtLines.push(`My fusion from ${parentList} is incomplete. Some productions failed.`);
    }

    thoughtLines.push("");

    await child.appendThought(
      block(thoughtLines)
    );
  }

  /**
   * 記錄 Incomplete History
   */
  async _recordIncompleteHistory(parentCells, child, errors) {
    const errorList = errors.map(err => `- ${err.stage}: ${err.message}`).join("\n");
    const parentIds = parentCells.map(cell => cell.id);

    // 1. Parent History
    for (const parent of parentCells) {
      const historyEntry = block([
        `## Incomplete Fusion`,
        "",
        `Child: ${child.id}`,
        "Parents:",
        ...parentIds.map(id => `- ${id}`),
        "",
        "Errors:",
        errorList,
        "",
      ]);

      try {
        await parent.appendHistory(historyEntry);
      } catch (error) {
        console.warn(`  ⚠️  Failed to record incomplete history for ${parent.id}: ${error.message}`);
      }
    }

    // 2. Child History
    const childHistoryEntry = block([
      `## Incomplete Fusion`,
      "",
      "Parents:",
      ...parentIds.map(id => `- ${id}`),
      "",
      "Errors:",
      errorList,
      "",
    ]);

    try {
      await child.appendHistory(childHistoryEntry);
    } catch (error) {
      console.warn(`  ⚠️  Failed to record incomplete history for child: ${error.message}`);
    }
  }
}
