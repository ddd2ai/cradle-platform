/**
 * living-context-service.js
 * 
 * Living Context 服務
 * 負責透過 AI 產生 Living Context Transformation Plans
 */

import { buildLivingContextDivisionPrompt } from "./living-context-prompts.js";
import { normalizeLivingContext, validateLivingContext } from "./living-context-schema.js";
import { parseLooseJsonObject } from "../utils/json-parser.js";

export class LivingContextService {
  /**
   * @param {Object} options
   * @param {Object} options.requesterCell - 用於呼叫 AI 的 Cell
   */
  constructor({ requesterCell }) {
    if (!requesterCell) {
      throw new Error("LivingContextService: requesterCell is required");
    }
    this.requesterCell = requesterCell;
  }

  /**
   * 建立 Division Transformation Plan
   * 
   * @param {Object} options
   * @param {Object} options.parentCell - Parent Cell
   * @param {string} options.childId - Child Cell ID
   * @param {Object} options.dnaDivisionPlan - DNA Division Plan
   * @param {Object} options.parentSource - Parent Source Material (from SourceMaterialService)
   * @returns {Promise<Object>} Division Transformation Plan
   */
  async createDivisionPlan({ parentCell, childId, dnaDivisionPlan, parentSource }) {
    if (!parentCell) {
      throw new Error("createDivisionPlan: parentCell is required");
    }
    if (!childId) {
      throw new Error("createDivisionPlan: childId is required");
    }
    if (!dnaDivisionPlan) {
      throw new Error("createDivisionPlan: dnaDivisionPlan is required");
    }
    if (!parentSource) {
      throw new Error("createDivisionPlan: parentSource is required");
    }

    // 1. 建立 Prompt
    const prompt = buildLivingContextDivisionPrompt({
      parentSource,
      dnaDivisionPlan,
      childId
    });

    // 2. 呼叫 AI (timeout 180秒)
    let rawResponse;
    try {
      rawResponse = await this.requesterCell.askWithTimeout(prompt, 180000);
    } catch (error) {
      throw new Error(`createDivisionPlan: AI call failed - ${error.message}`);
    }

    if (!rawResponse || typeof rawResponse !== "string") {
      throw new Error("createDivisionPlan: AI returned empty or invalid response");
    }

    // 3. Parse JSON
    let plan;
    try {
      plan = parseLooseJsonObject(rawResponse);
    } catch (error) {
      throw new Error(`createDivisionPlan: Failed to parse AI response as JSON - ${error.message}`);
    }

    if (!plan || typeof plan !== "object") {
      throw new Error("createDivisionPlan: Parsed plan is not a valid object");
    }

    // 4. Normalize
    plan = this.normalizeDivisionPlan(plan, parentCell.id, childId);

    // 5. Validate
    const validation = this.validateDivisionPlan(plan, parentSource);
    if (!validation.valid) {
      throw new Error(`createDivisionPlan: Plan validation failed:\n${validation.errors.join("\n")}`);
    }

    return plan;
  }

  /**
   * 正規化 Division Plan
   */
  normalizeDivisionPlan(plan, expectedParentId, expectedChildId) {
    const normalized = { ...plan };

    // 確保基本欄位
    normalized.type = "living-context-division";
    normalized.parentCellId = expectedParentId;
    normalized.childCellId = expectedChildId;

    // 正規化 Living Contexts
    if (normalized.revisedParentLivingContext) {
      normalized.revisedParentLivingContext = normalizeLivingContext({
        cellId: expectedParentId,
        ...normalized.revisedParentLivingContext
      });
    }

    if (normalized.childLivingContext) {
      normalized.childLivingContext = normalizeLivingContext({
        cellId: expectedChildId,
        ...normalized.childLivingContext
      });
    }

    // 正規化 Memory Seed
    if (!normalized.childMemorySeed || typeof normalized.childMemorySeed !== "object") {
      normalized.childMemorySeed = {
        knowledge: "",
        history: "",
        thought: ""
      };
    } else {
      normalized.childMemorySeed = {
        knowledge: typeof normalized.childMemorySeed.knowledge === "string" 
          ? normalized.childMemorySeed.knowledge.trim() 
          : "",
        history: typeof normalized.childMemorySeed.history === "string"
          ? normalized.childMemorySeed.history.trim()
          : "",
        thought: typeof normalized.childMemorySeed.thought === "string"
          ? normalized.childMemorySeed.thought.trim()
          : ""
      };
    }

    // 正規化 Production Plan
    if (!Array.isArray(normalized.productionPlan)) {
      normalized.productionPlan = [];
    } else {
      normalized.productionPlan = normalized.productionPlan.map(item => ({
        type: item.type || "code",
        title: typeof item.title === "string" ? item.title.trim() : "",
        goal: typeof item.goal === "string" ? item.goal.trim() : "",
        constraints: Array.isArray(item.constraints) 
          ? item.constraints.filter(c => typeof c === "string" && c.trim() !== "").map(c => c.trim())
          : [],
        sourceArtifactIds: Array.isArray(item.sourceArtifactIds)
          ? item.sourceArtifactIds.filter(id => typeof id === "string" && id.trim() !== "").map(id => id.trim())
          : [],
        sourceUsage: item.sourceUsage || "reference"
      }));
    }

    // 正規化其他陣列欄位
    normalized.sharedContracts = Array.isArray(normalized.sharedContracts)
      ? normalized.sharedContracts.filter(c => typeof c === "string" && c.trim() !== "").map(c => c.trim())
      : [];

    normalized.assumptions = Array.isArray(normalized.assumptions)
      ? normalized.assumptions.filter(a => typeof a === "string" && a.trim() !== "").map(a => a.trim())
      : [];

    return normalized;
  }

  /**
   * 驗證 Division Plan
   */
  validateDivisionPlan(plan, parentSource) {
    const errors = [];

    // 驗證基本結構
    if (plan.type !== "living-context-division") {
      errors.push("Plan type must be 'living-context-division'");
    }

    if (!plan.parentCellId) {
      errors.push("parentCellId is required");
    }

    if (!plan.childCellId) {
      errors.push("childCellId is required");
    }

    // 驗證 Living Contexts
    if (!plan.revisedParentLivingContext) {
      errors.push("revisedParentLivingContext is required");
    } else {
      const parentValidation = validateLivingContext(plan.revisedParentLivingContext);
      if (!parentValidation.valid) {
        errors.push(`revisedParentLivingContext validation failed: ${parentValidation.errors.join(", ")}`);
      }
    }

    if (!plan.childLivingContext) {
      errors.push("childLivingContext is required");
    } else {
      const childValidation = validateLivingContext(plan.childLivingContext);
      if (!childValidation.valid) {
        errors.push(`childLivingContext validation failed: ${childValidation.errors.join(", ")}`);
      }
    }

    // 驗證 Memory Seed
    if (!plan.childMemorySeed || typeof plan.childMemorySeed !== "object") {
      errors.push("childMemorySeed is required and must be an object");
    }

    // 驗證 Production Plan 中的 sourceArtifactIds
    if (Array.isArray(plan.productionPlan)) {
      const availableArtifactIds = parentSource.artifactCatalog
        ? parentSource.artifactCatalog.map(a => a.artifactId)
        : [];

      plan.productionPlan.forEach((item, index) => {
        if (!item.title || item.title.trim() === "") {
          errors.push(`productionPlan[${index}].title is required`);
        }
        if (!item.goal || item.goal.trim() === "") {
          errors.push(`productionPlan[${index}].goal is required`);
        }

        // 驗證 sourceArtifactIds 是否存在
        if (Array.isArray(item.sourceArtifactIds)) {
          item.sourceArtifactIds.forEach(artifactId => {
            if (!availableArtifactIds.includes(artifactId)) {
              errors.push(`productionPlan[${index}] references non-existent artifact: ${artifactId}`);
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
