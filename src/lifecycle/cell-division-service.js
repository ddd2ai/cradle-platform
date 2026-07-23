/**
 * cell-division-service.js
 * 
 * Cell Division Service
 * 整合 DNA Division 與 Living Context Division
 * 
 * 第三階段：不包含 Production Regeneration
 */

import { LivingContextService } from "../living-context/living-context-service.js";
import { ArtifactRegenerationService } from "../production/artifact-regeneration-service.js";
import { createLivingContext, normalizeLivingContext } from "../living-context/living-context-schema.js";
import { deduplicateRelationships } from "../living-context/relationship-utils.js";
import { block } from "../utils/text.js";
import {
  logProductionResult,
  runApplicationStage,
} from "./application-stage.js";
import {
  validateBasicDivisionSemantics,
  validateProductionPlan,
  validateSharedContractReferences,
} from "./division-plan-validator.js";

export class CellDivisionService {
  /**
   * @param {Object} options
   * @param {Function} [options.livingContextServiceFactory] - Factory for LivingContextService
   * @param {Object} [options.artifactRegenerationService] - Artifact Regeneration Service
   */
  constructor({ 
    livingContextServiceFactory,
    artifactRegenerationService 
  } = {}) {
    this.livingContextServiceFactory = livingContextServiceFactory || ((requesterCell) => {
      return new LivingContextService({ requesterCell });
    });

    this.artifactRegenerationService = 
      artifactRegenerationService ?? 
      new ArtifactRegenerationService();
  }

  /**
   * 執行完整的 Cell Division
   * 
   * @param {Object} options
   * @param {Object} options.engine - Cradle Engine
   * @param {Object} options.parentCell - Parent Cell
   * @param {string} options.childId - Child Cell ID
   * @returns {Promise<Object>} Division result
   */
  async divide({ engine, parentCell, childId }) {
    this._validateParameters({ engine, parentCell, childId });

    if (this._childExists(engine, childId)) {
      throw new Error(`CellDivisionService: child cell already exists: ${childId}`);
    }

    const {
      dnaDivisionPlan,
      livingContextPlan,
    } = await this._createDivisionPlans({
      engine,
      parentCell,
      childId,
    });

    let child;
    const errors = [];

    try {
      console.log(`  Creating child cell...`);
      child = await engine.createCell(childId);

      await runApplicationStage(errors, "apply-dna", async () => {
        console.log(`  Applying DNA division...`);
        await parentCell.applyDivisionPlanBySVD(child, dnaDivisionPlan);
      });

      await runApplicationStage(errors, "apply-living-context", async () => {
        console.log(`  Applying Living Context transformation...`);
        await this._applyLivingContextPlan({
          parentCell,
          childCell: child,
          plan: livingContextPlan,
          dnaDivisionPlan,
        });
      });

      const productionResult =
        await this._regenerateProductions({
          parentCell,
          child,
          livingContextPlan,
          errors,
        });

      console.log(`  ✅ Application phase complete`);

      return this._createDivisionResult({
        parentCell,
        child,
        dnaDivisionPlan,
        livingContextPlan,
        productionResult,
        errors,
      });

    } catch (error) {
      await this._recordIncompleteApplication({
        parentCell,
        child,
        childId,
        errors,
        error,
      });

      return {
        parentCell,
        child,
        dnaDivisionPlan,
        livingContextPlan,
        productionResult: this._createFailedProductionResult(),
        complete: false,
        errors,
      };
    }
  }

  async _createDivisionPlans({ engine, parentCell, childId }) {
    try {
      console.log(`  Planning DNA division...`);
      const dnaDivisionPlan = await parentCell.createDivisionPlanBySVD(childId);

      console.log(`  Planning Living Context transformation...`);
      const livingContextService = this.livingContextServiceFactory(parentCell);
      const parentArtifacts = await this._listArtifacts(parentCell);

      console.log(`  Found ${parentArtifacts.length} parent artifact(s)`);

      const livingContextPlan = await livingContextService.createDivisionPlan({
        parentCell,
        childId,
        dnaDivisionPlan,
        parentArtifacts,
      });

      livingContextPlan.productionPlan ??= [];
      livingContextPlan.sharedContracts ??= [];

      validateProductionPlan({
        parentArtifacts,
        livingContextPlan,
        parentCellId: parentCell.id,
        childId,
      });

      validateBasicDivisionSemantics({
        livingContextPlan,
      });

      validateSharedContractReferences({
        engine,
        parentCellId: parentCell.id,
        childId,
        livingContextPlan,
      });

      console.log(`  ✅ Planning phase complete`);

      return {
        dnaDivisionPlan,
        livingContextPlan,
      };
    } catch (error) {
      // Planning 失敗：不可建立 Child
      throw new Error(`CellDivisionService: planning failed: ${error.message}`, {
        cause: error
      });
    }
  }

  async _regenerateProductions({ parentCell, child, livingContextPlan, errors }) {
    console.log(`  Regenerating productions...`);

    try {
      const productionResult =
        await this.artifactRegenerationService.regenerateForDivision({
          parentCell,
          childCell: child,
          divisionPlan: livingContextPlan
        });

      logProductionResult(productionResult);
      await this._recordProductionHistory(parentCell, child, productionResult);
      return productionResult;
    } catch (error) {
      errors.push({
        stage: "production",
        message: error.message,
      });

      return {
        produced: [],
        parentRevisions: [],
        failed: [{
          index: -1,
          title: "unknown",
          stage: "production",
          message: error.message
        }],
        skipped: [],
        complete: false
      };
    }
  }

  _createDivisionResult({
    parentCell,
    child,
    dnaDivisionPlan,
    livingContextPlan,
    productionResult,
    errors,
  }) {
    return {
      parentCell,
      child,
      dnaDivisionPlan,
      livingContextPlan,
      productionResult,
      complete: errors.length === 0 && productionResult.complete,
      errors: [
        ...errors,
        ...productionResult.failed.map(failure => ({
          stage: "production",
          message: failure.message,
          title: failure.title
        }))
      ],
    };
  }

  async _recordIncompleteApplication({
    parentCell,
    child,
    childId,
    errors,
    error,
  }) {
    // Application 失敗：Child 已經建立，記錄 incomplete 狀態
    if (!child) {
      return;
    }

    try {
      await child.appendHistory(
        block([
          `## Division Application Incomplete`,
          "",
          `Failed at: ${errors[0]?.stage || "unknown"}`,
          `Error: ${errors[0]?.message || error.message}`,
          `Time: ${new Date().toISOString()}`,
          "",
        ])
      );
    } catch {
      // 記錄失敗不應中斷
    }

    try {
      await parentCell.appendHistory(
        block([
          `## Division Application Incomplete`,
          "",
          `Child: ${childId}`,
          `Failed at: ${errors[0]?.stage || "unknown"}`,
          `Error: ${errors[0]?.message || error.message}`,
          `Time: ${new Date().toISOString()}`,
          "",
        ])
      );
    } catch {
      // 記錄失敗不應中斷
    }
  }

  _createFailedProductionResult() {
    return {
      produced: [],
      parentRevisions: [],
      failed: [],
      skipped: [],
      complete: false
    };
  }

  /**
   * 驗證參數
   * @private
   */
  _validateParameters({ engine, parentCell, childId }) {
    if (!engine) {
      throw new Error("CellDivisionService: engine is required");
    }
    if (!parentCell) {
      throw new Error("CellDivisionService: parentCell is required");
    }
    if (!parentCell.id) {
      throw new Error("CellDivisionService: parentCell.id is required");
    }
    if (!childId || typeof childId !== 'string' || childId.trim() === "") {
      throw new Error("CellDivisionService: childId must be a non-empty string");
    }
    if (childId === parentCell.id) {
      throw new Error("CellDivisionService: childId must not equal parentCell.id");
    }
    if (!engine.createCell || typeof engine.createCell !== 'function') {
      throw new Error("CellDivisionService: engine.createCell must exist");
    }
  }

  /**
   * 檢查 Child 是否已存在
   * @private
   */
  _childExists(engine, childId) {
    // 優先使用 hasCell
    if (engine.hasCell && typeof engine.hasCell === 'function') {
      return engine.hasCell(childId);
    }

    // 備用：使用 getCell
    if (engine.getCell && typeof engine.getCell === 'function') {
      try {
        const cell = engine.getCell(childId);
        return !!cell;
      } catch {
        return false;
      }
    }

    // 備用：使用 cells Map
    if (engine.cells && engine.cells.has) {
      return engine.cells.has(childId);
    }

    return false;
  }

  /**
   * 取得 Parent Cell 的 Artifact 清單
   *
   * @private
   */
  async _listArtifacts(cell) {
    const store =
      cell.artifactStore ??
      cell.productionService?.store;

    if (
      !store ||
      typeof store.listArtifactSummaries !== "function"
    ) {
      return [];
    }

    const result =
      await store.listArtifactSummaries();

    const artifacts = result?.artifacts ?? [];

    if (!Array.isArray(artifacts)) {
      throw new Error(
        "CellDivisionService: artifact summaries must be an array"
      );
    }

    return artifacts;
  }

  /**
   * 套用 Living Context Division Plan
   * @private
   */
  async _applyLivingContextPlan({ parentCell, childCell, plan, dnaDivisionPlan }) {
    // 1. 寫入 Parent Living Context
    await this._applyParentLivingContext(parentCell, plan.revisedParentLivingContext);

    // 2. 寫入 Child Living Context
    await this._applyChildLivingContext(childCell, plan.childLivingContext);

    // 3. 寫入 Child Memory Seed
    await this._applyChildMemorySeed(childCell, plan.childMemorySeed, parentCell.id, dnaDivisionPlan);

    // 4. 同步 Responsibilities
    await this._syncResponsibilities(parentCell, childCell, plan);

    // 5. 建立 Living Context Relationships
    await this._createLivingContextRelationships(parentCell, childCell, plan);

    // 6. 寫入 Division History
    await this._recordDivisionHistory(parentCell, childCell, plan, dnaDivisionPlan);
  }

  /**
   * 寫入 Parent Living Context
   * @private
   */
  async _applyParentLivingContext(parentCell, revisedContext) {
    const existingContext = await parentCell.readLivingContext();

    const parentContext = normalizeLivingContext({
      ...existingContext,
      ...revisedContext,
      id: existingContext?.id ?? `living-context-${parentCell.id}`,
      cellId: parentCell.id,
      createdAt: existingContext?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await parentCell.writeLivingContext(parentContext);
  }

  /**
   * 寫入 Child Living Context
   * @private
   */
  async _applyChildLivingContext(childCell, childContext) {
    const context = createLivingContext({
      ...childContext,
      cellId: childCell.id,
      id: `living-context-${childCell.id}`,
    });

    await childCell.writeLivingContext(context);
  }

  /**
   * 寫入 Child Memory Seed
   * @private
   */
  async _applyChildMemorySeed(childCell, memorySeed, parentId, dnaDivisionPlan) {
    // 1. 建立 Identity
    const identityContent = block([
      "# Identity",
      "",
      `I am ${childCell.id}.`,
      "",
      `I was born through division from ${parentId}.`,
      "",
      "My specialization is defined by my Living Context.",
      "",
    ]);

    await childCell.writeMemory("identity", identityContent);

    // 2. Knowledge（如果有）
    if (memorySeed?.knowledge && memorySeed.knowledge.trim() !== "") {
      await childCell.writeMemory("knowledge", `# Knowledge\n\n${memorySeed.knowledge}`);
    } else {
      // 保留初始標題
      await childCell.writeMemory("knowledge", "# Knowledge\n\n");
    }

    // 3. History（從 Parent 記錄來源）
    let historyContent = block([
      "# History",
      "",
      `## Birth from ${parentId}`,
      "",
      `Born at: ${new Date().toISOString()}`,
      `Role: ${dnaDivisionPlan.role}`,
      `Reason: ${dnaDivisionPlan.reason}`,
      "",
    ]);

    if (memorySeed?.history && memorySeed.history.trim() !== "") {
      historyContent += `\n${memorySeed.history}\n`;
    }

    await childCell.writeMemory("history", historyContent);

    // 4. Thought（如果有）
    if (memorySeed?.thought && memorySeed.thought.trim() !== "") {
      await childCell.appendThought(memorySeed.thought);
    }
  }

  /**
   * 同步 Responsibilities
   * @private
   */
  async _syncResponsibilities(parentCell, childCell, plan) {
    // Parent responsibilities
    if (plan.revisedParentLivingContext.responsibilities) {
      await parentCell.setResponsibilities(
        plan.revisedParentLivingContext.responsibilities
      );
    }

    // Child responsibilities
    if (plan.childLivingContext.responsibilities) {
      await childCell.setResponsibilities(
        plan.childLivingContext.responsibilities
      );
    }
  }

  /**
   * 建立 Living Context Relationships
   * @private
   */
  async _createLivingContextRelationships(parentCell, childCell, plan) {
    // Parent relationships
    const parentRelationships = [
      { type: "divided-into", target: childCell.id },
      ...(plan.revisedParentLivingContext.relationships || [])
    ];

    // 去重（type + target）
    const parentUnique = deduplicateRelationships(parentRelationships);

    for (const rel of parentUnique) {
      // 檢查是否已存在
      const existing = await parentCell.listRelationships();
      const exists = existing.some(
        e => e.type === rel.type && e.target === rel.target
      );

      if (!exists) {
        await parentCell.addRelationship(rel.type, rel.target);
      }
    }

    // Child relationships
    const childRelationships = [
      { type: "born-from", target: parentCell.id },
      ...(plan.childLivingContext.relationships || [])
    ];

    const childUnique = deduplicateRelationships(childRelationships);

    for (const rel of childUnique) {
      const existing = await childCell.listRelationships();
      const exists = existing.some(
        e => e.type === rel.type && e.target === rel.target
      );

      if (!exists) {
        await childCell.addRelationship(rel.type, rel.target);
      }
    }
  }

  /**
   * 記錄 Division History
   * @private
   */
  async _recordDivisionHistory(parentCell, childCell, plan, dnaDivisionPlan) {
    // Parent History
    await parentCell.appendHistory(
      block([
        `## Living Context Division`,
        "",
        `Child: ${childCell.id}`,
        `Reason: ${dnaDivisionPlan.reason}`,
        `Child role: ${dnaDivisionPlan.role}`,
        `Transferred responsibilities:`,
        ...(plan.childLivingContext.responsibilities || []).map(r => `- ${r}`),
        `Retained responsibilities:`,
        ...(plan.revisedParentLivingContext.responsibilities || []).map(r => `- ${r}`),
        "",
      ])
    );

    // Parent Thought
    await parentCell.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        `I divided part of my Living Context into ${childCell.id}.`,
        "",
      ])
    );

    // Child History
    await childCell.appendHistory(
      block([
        `## Birth by Living Context Division`,
        "",
        `Parent: ${parentCell.id}`,
        `Role: ${dnaDivisionPlan.role}`,
        `Purpose: ${plan.childLivingContext.purpose || "N/A"}`,
        `Responsibilities:`,
        ...(plan.childLivingContext.responsibilities || []).map(r => `- ${r}`),
        "",
      ])
    );

    // Child Thought
    const responsibilitySummary = (plan.childLivingContext.responsibilities || []).join(", ");
    
    await childCell.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        `I was born from ${parentCell.id} with responsibility for ${responsibilitySummary || "specialized tasks"}.`,
        "",
      ])
    );
  }

  /**
   * 記錄 Production Regeneration History
   * @private
   */
  async _recordProductionHistory(parentCell, childCell, productionResult) {
    const parentRevisions = productionResult.parentRevisions || [];
    const planned =
      productionResult.produced.length +
      parentRevisions.length +
      productionResult.failed.length;

    // Child History
    const childHistoryLines = [
      `## Production Regeneration`,
      "",
      `Planned: ${planned}`,
      `Produced: ${productionResult.produced.length}`,
      `Parent revised: ${parentRevisions.length}`,
      `Failed: ${productionResult.failed.length}`,
      "",
    ];

    if (productionResult.produced.length > 0) {
      childHistoryLines.push(`Produced:`);
      productionResult.produced.forEach(item => {
        childHistoryLines.push(`- ${item.title}: ${item.artifactId}`);
      });
      childHistoryLines.push("");
    }

    if (productionResult.failed.length > 0) {
      childHistoryLines.push(`Failed:`);
      productionResult.failed.forEach(item => {
        childHistoryLines.push(`- ${item.title}: ${item.message}`);
      });
      childHistoryLines.push("");
    }

    await childCell.appendHistory(block(childHistoryLines));

    // Parent History
    const parentHistoryLines = [
      `## Child Production Regeneration`,
      "",
      `Child: ${childCell.id}`,
      `Child produced: ${productionResult.produced.length}`,
      `Parent revised: ${parentRevisions.length}`,
      `Failed: ${productionResult.failed.length}`,
      "",
    ];

    if (parentRevisions.length > 0) {
      parentHistoryLines.push(`Parent Revised Artifacts:`);
      parentRevisions.forEach(item => {
        parentHistoryLines.push(`- ${item.title}: ${item.artifactId}`);
      });
      parentHistoryLines.push("");
    }

    await parentCell.appendHistory(block(parentHistoryLines));
  }
}
