/**
 * artifact-regeneration-service.js
 * 
 * Artifact Regeneration Service
 * 負責在 Cell Division/Fusion 時重新生成 Artifacts
 */

import { SourceMaterialService } from "../living-context/source-material-service.js";
import { ArtifactRelationService } from "./artifact-relation-service.js";
import {
  createDivisionProductionResult,
  createFusionProductionResult,
} from "./production-result.js";

export class ArtifactRegenerationService {
  constructor({
    sourceMaterialService,
    artifactRelationService,
  } = {}) {
    this.sourceMaterialService = 
      sourceMaterialService ?? 
      new SourceMaterialService();
    this.artifactRelationService =
      artifactRelationService ??
      new ArtifactRelationService();
  }

  /**
   * 為 Division 重新生成 Artifacts
   * 
   * @param {Object} options
   * @param {Object} options.parentCell - Parent Cell
   * @param {Object} options.childCell - Child Cell
   * @param {Object} options.divisionPlan - Living Context Division Plan
   * @returns {Promise<Object>} paired parent/child products and relations
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

    const productionPlan = divisionPlan.productionPlan;

    if (productionPlan.length === 0) {
      throw new Error(
        "regenerateForDivision: productionPlan must create parent and child products"
      );
    }

    if (!parentCell.productionService) {
      throw new Error("parentCell.productionService is required");
    }

    if (typeof parentCell.productionService.produceDivisionProductPair !== "function") {
      throw new Error(
        "parentCell.productionService.produceDivisionProductPair is required"
      );
    }

    const supportedActions = new Set(["derive", "keep", "transfer"]);
    for (const item of productionPlan) {
      const action = item.action || "derive";
      if (!supportedActions.has(action)) {
        throw new Error(`Unsupported division production action: ${action}`);
      }
    }

    const produced = [];
    const parentRevisions = [];
    const relations = [];
    const failed = [];
    const skipped = productionPlan
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.action === "keep" || item.action === "transfer")
      .map(({ item, index }) => ({
        index,
        title: item.title || item.sourceArtifactId,
        sourceArtifactId: item.sourceArtifactId,
        action: item.action,
        targetCellId: item.targetCellId,
        reason: item.reason || "",
      }));
    const derivedItems = productionPlan.filter(
      (item) => (item.action || "derive") === "derive"
    );

    if (derivedItems.length === 0) {
      throw new Error(
        "regenerateForDivision: productionPlan requires at least one derive action"
      );
    }

    try {
      // All derived source material is intentionally generated in one parent prompt.
      const result = await this._processDivisionProductionPair({
        items: derivedItems,
        parentCell,
        childCell,
        divisionPlan,
      });
      produced.push(result.produced);
      parentRevisions.push(result.parentRevision);
      relations.push(result.relation);
    } catch (error) {
      console.error("Failed to generate division product pair", error);
      failed.push({
        index: 0,
        title: "Division product pair",
        stage: "production",
        message: error.message,
      });
    }

    return { 
      produced, 
      parentRevisions,
      relations,
      failed, 
      skipped,
      complete: failed.length === 0
    };
  }

  async _processDivisionProductionPair({
    items,
    parentCell,
    childCell,
    divisionPlan,
  }) {
    const item = this._mergeDivisionProductionItems(items, divisionPlan);
    const index = 0;
    const sourceArtifactIds = item.sourceArtifactIds;
    const sourceResult = await this.sourceMaterialService.loadSelectedArtifacts(
      parentCell,
      sourceArtifactIds
    );
    const sourceWarnings = this._createSourceWarnings(sourceResult);
    const sourceArtifact = sourceResult.artifacts[0] || {};
    const title = this._resolveDivisionArtifactTitle({ item, sourceArtifact });
    const type = this._selectDivisionArtifactType({
      item,
      sourceArtifact,
    });
    const goal = this._buildDivisionArtifactGoal({
      item,
      sourceArtifact,
      divisionPlan,
      type,
    });

    const parentRevisionTitle =
      this._resolveParentRevisionTitle({
        item,
        sourceArtifact,
      });
    const parentRevisionGoal = this._buildParentRevisionGoal({
      item,
      sourceArtifact,
      divisionPlan,
      childCell,
      type,
    });

    const pairResult = await parentCell.productionService.produceDivisionProductPair({
      parentCell,
      childCell,
      type,
      parentTitle: parentRevisionTitle,
      childTitle: title,
      parentGoal: parentRevisionGoal,
      childGoal: goal,
      parentLivingContext: divisionPlan.revisedParentLivingContext,
      childLivingContext: divisionPlan.childLivingContext,
      childMemorySeed: divisionPlan.childMemorySeed,
      sharedContracts: divisionPlan.sharedContracts ?? [],
      constraints: item.constraints ?? [],
      sourceArtifacts: sourceResult.artifacts,
      sourceWarnings,
      sourceArtifactIds,
    });

    const parentRevision = this._createParentRevisionRecord({
      index,
      title: parentRevisionTitle,
      parentCell,
      parentRevisionResult: pairResult.parentProduct,
      sourceArtifactIds,
    });

    const produced = this._createDivisionProducedRecord({
      index,
      title,
      childCell,
      producedResult: pairResult.childProduct,
      sourceArtifactIds,
    });

    const relation = await this.artifactRelationService.linkDivisionProducts({
      parentCell,
      childCell,
      parentProduct: parentRevision,
      childProduct: produced,
      divisionPlan,
      productContract: pairResult.productContract,
    });

    return {
      produced,
      parentRevision,
      relation,
    };
  }

  _mergeDivisionProductionItems(items, divisionPlan) {
    if (items.length === 1) {
      return {
        ...items[0],
        sourceArtifactIds: this._resolveDivisionSourceArtifactIds(items[0]),
      };
    }

    const childPurpose = divisionPlan.childLivingContext?.purpose || "Child";
    return {
      action: "derive",
      type: items.find((item) => item.type === "code")?.type ?? items[0].type,
      title: `${childPurpose} Division Product`,
      sourceArtifactId: items.map((item) => item.sourceArtifactId).join(", "),
      sourceArtifactIds: items.flatMap(
        (item) => this._resolveDivisionSourceArtifactIds(item)
      ),
      constraints: items.flatMap((item) => item.constraints ?? []),
      reason: items.map((item) => item.reason).filter(Boolean).join("; "),
    };
  }

  _resolveDivisionSourceArtifactIds(item) {
    return Array.isArray(item.sourceArtifactIds)
      ? item.sourceArtifactIds
      : [item.sourceArtifactId].filter(Boolean);
  }

  _createSourceWarnings(sourceResult) {
    return sourceResult.errors.map(
      error => `${error.artifactId}: ${error.error}`
    );
  }

  _resolveDivisionArtifactTitle({ item, sourceArtifact }) {
    return (
      item.title ||
      (
        sourceArtifact.title
          ? `${sourceArtifact.title} Derivative`
          : "Derived Artifact"
      )
    );
  }

  _resolveParentRevisionTitle({ item, sourceArtifact }) {
    return sourceArtifact.title
      ? `${sourceArtifact.title} Parent Boundary Revision`
      : `${item.sourceArtifactId} Parent Boundary Revision`;
  }

  _createDivisionProducedRecord({
    index,
    title,
    childCell,
    producedResult,
    sourceArtifactIds,
  }) {
    const artifact = producedResult.artifact || producedResult;
    const saved = producedResult.saved || {};

    return {
      index,
      title,
      targetCellId: childCell.id,
      artifactId: artifact.id,
      dir: saved.dir,
      sourceArtifactIds
    };
  }

  _createParentRevisionRecord({
    index,
    title,
    parentCell,
    parentRevisionResult,
    sourceArtifactIds,
  }) {
    const parentArtifact = parentRevisionResult.artifact || parentRevisionResult;
    const parentSaved = parentRevisionResult.saved || {};

    return {
      index,
      title,
      targetCellId: parentCell.id,
      artifactId: parentArtifact.id,
      dir: parentSaved.dir,
      sourceArtifactIds,
    };
  }

  _selectDivisionArtifactType({ item, sourceArtifact }) {
    if (item.type) {
      return item.type;
    }

    return sourceArtifact.type || "code";
  }

  _buildDivisionArtifactGoal({ item, sourceArtifact, divisionPlan, type }) {
    const childContext = divisionPlan.childLivingContext || {};
    const childPurpose = childContext.purpose || "the child cell specialization";
    const childResponsibilities = Array.isArray(childContext.responsibilities)
      ? childContext.responsibilities
      : [];

    if (type === "code") {
      return [
        `從 source artifact ${item.sourceArtifactId} 衍生一個同類型的完整專化 code artifact。`,
        "若 source artifact 是 Spring Boot / Hexagonal Architecture 專案，child artifact 也必須是可落檔的 Spring Boot / Hexagonal Architecture 專案，而不是說明文件。",
        `Child purpose: ${childPurpose}`,
        childResponsibilities.length > 0
          ? `Child responsibilities: ${childResponsibilities.join("; ")}`
          : "",
        item.reason ? `Specialization reason: ${item.reason}` : "",
        "保留 Java 21、Spring Boot、Hexagonal Architecture、MariaDB 的技術方向，並依 Child Living Context 調整 bounded context、ports、adapters、domain model 與 contracts。",
      ]
        .filter(Boolean)
        .join("\n");
    }

    return (
      item.goal ||
      item.reason ||
      sourceArtifact.goal ||
      `Derive a specialized child artifact from ${item.sourceArtifactId}`
    );
  }

  _buildParentRevisionGoal({ item, sourceArtifact, divisionPlan, childCell, type }) {
    const parentContext = divisionPlan.revisedParentLivingContext || {};
    const childContext = divisionPlan.childLivingContext || {};
    const sharedContracts = Array.isArray(divisionPlan.sharedContracts)
      ? divisionPlan.sharedContracts
      : [];

    const contractSummary = sharedContracts.length > 0
      ? sharedContracts.map((contract) => {
          const consumers = Array.isArray(contract.consumerCellIds)
            ? contract.consumerCellIds.join(", ")
            : "";
          return `${contract.name || "contract"} owner=${contract.ownerCellId || "-"} consumers=${consumers}`;
        }).join("; ")
      : "none";

    if (type === "code") {
      return [
        `從 source artifact ${item.sourceArtifactId} 產生 Parent 分裂後的 revised code artifact。`,
        "這不是 child artifact；這是 Parent service 在分裂後保留自身責任的新版本。",
        `Child cell: ${childCell.id}`,
        `Child purpose: ${childContext.purpose || "-"}`,
        "必須移除已分裂給 Child 的 domain model、application service、repository、adapter、provider implementation 或 persistence ownership。",
        "Parent 若仍需要 Child 能力，只能透過 output port、API client、event publisher/subscriber、或 shared contract 呼叫 Child。",
        "若 Parent 與 Child 都是 Spring Boot service，Parent revised artifact 應保持 Spring Boot / Hexagonal Architecture 專案形狀，並加入呼叫 Child service 的 adapter，例如 REST client 或明確 contract interface。",
        "Parent 不可直接引用 Child 的 adapter class、provider DTO、外部 provider error code 或 Child persistence model。",
        `Parent purpose: ${parentContext.purpose || "-"}`,
        Array.isArray(parentContext.responsibilities) && parentContext.responsibilities.length > 0
          ? `Parent retained responsibilities: ${parentContext.responsibilities.join("; ")}`
          : "",
        `Shared contracts: ${contractSummary}`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      `Revise parent artifact ${item.sourceArtifactId} after division.`,
      `Remove child-owned material for ${childCell.id}.`,
      "Keep parent responsibilities and express collaboration through explicit contracts.",
    ].join("\n");
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
      return createFusionProductionResult();
    }

    const produced = [];
    const failed = [];
    const skipped = [];

    // Process each production item sequentially
    for (let index = 0; index < productionPlan.length; index++) {
      const item = productionPlan[index];

      try {
        const {
          sourceArtifacts,
          sourceWarnings,
        } = await this._loadFusionSourceArtifacts({
          parentCells,
          sourceArtifactRefs: item.sourceArtifacts || [],
        });

        // Call production service with transformation context
        const { artifact, saved } =
          await childCell.productionService.produceFromTransformation(
            this._createFusionProductionRequest({
              item,
              parentCells,
              childCell,
              fusionPlan,
              sourceArtifacts,
              sourceWarnings,
            })
          );

        // Record success
        produced.push({
          index,
          title: item.title,
          artifactId: artifact.id,
          dir: saved.dir,
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

  async _loadFusionSourceArtifacts({
    parentCells,
    sourceArtifactRefs,
  }) {
    // 依 Parent 分組 Source Artifacts
    const artifactsByParent =
      this._groupArtifactsByParent(sourceArtifactRefs);

    const sourceArtifacts = [];
    const sourceWarnings = [];

    for (const [parentId, artifactIds] of artifactsByParent.entries()) {
      const parentCell = parentCells.find(cell => cell.id === parentId);

      if (!parentCell) {
        sourceWarnings.push(`Unknown parent cell: ${parentId}`);
        continue;
      }

      try {
        const sourceResult =
          await this.sourceMaterialService.loadSelectedArtifacts(
            parentCell,
            artifactIds
          );

        sourceArtifacts.push(
          ...sourceResult.artifacts.map(artifact => ({
            ...artifact,
            sourceCellId: parentId
          }))
        );

        sourceResult.errors.forEach(error => {
          sourceWarnings.push(`${parentId}/${error.artifactId}: ${error.error}`);
        });
      } catch (error) {
        sourceWarnings.push(`Failed to load artifacts from ${parentId}: ${error.message}`);
      }
    }

    return {
      sourceArtifacts,
      sourceWarnings,
    };
  }

  _createFusionProductionRequest({
    item,
    parentCells,
    childCell,
    fusionPlan,
    sourceArtifacts,
    sourceWarnings,
  }) {
    const sourceArtifactRefs = item.sourceArtifacts || [];

    return {
      type: item.type,
      title: item.title,
      goal: item.goal,
      constraints: item.constraints || [],

      livingContext: fusionPlan.fusedLivingContext,
      distilledMemory: fusionPlan.fusedMemorySeed,

      sourceArtifacts,
      sourceWarnings,

      origin: {
        mode: 'fusion',
        sourceCellIds: parentCells.map(cell => cell.id),
        sourceArtifactIds: sourceArtifactRefs.map(
          source => source.artifactId
        ),
        sourceArtifactRefs,
        livingContextId: `living-context-${childCell.id}`
      }
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
