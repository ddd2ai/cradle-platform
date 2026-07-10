/**
 * living-context-service.js
 * 
 * Living Context 服務
 * 負責透過 AI 產生 Living Context Transformation Plans
 */

import { buildLivingContextDivisionPrompt } from "./living-context-prompts.js";
import { normalizeDivisionPlan, validateDivisionPlan } from "./division-plan-schema.js";
import { SourceMaterialService } from "./source-material-service.js";

export class LivingContextService {
  /**
   * @param {Object} options
   * @param {Object} options.requesterCell - 用於呼叫 AI 的 Cell
   * @param {Object} [options.sourceMaterialService] - Source Material Service（可選）
   */
  constructor({ requesterCell, sourceMaterialService }) {
    if (!requesterCell) {
      throw new Error("LivingContextService: requesterCell is required");
    }
    this.requesterCell = requesterCell;
    this.sourceMaterialService = sourceMaterialService || new SourceMaterialService();
  }

  /**
   * 建立 Division Transformation Plan
   * 
   * @param {Object} options
   * @param {Object} options.parentCell - Parent Cell
   * @param {string} options.childId - Child Cell ID
   * @param {Object} options.dnaDivisionPlan - DNA Division Plan
   * @returns {Promise<Object>} Division Transformation Plan
   */
  async createDivisionPlan({ parentCell, childId, dnaDivisionPlan }) {
    // 1. 驗證參數
    if (!parentCell) {
      throw new Error("LivingContextService: parentCell is required");
    }
    if (!parentCell.id) {
      throw new Error("LivingContextService: parentCell.id is required");
    }
    if (!childId || typeof childId !== 'string' || childId.trim() === "") {
      throw new Error("LivingContextService: childId must be a non-empty string");
    }
    if (childId === parentCell.id) {
      throw new Error("LivingContextService: childId must not equal parentCell.id");
    }
    if (!dnaDivisionPlan) {
      throw new Error("LivingContextService: dnaDivisionPlan is required");
    }

    // 2. 收集 Source Material
    let parentSource;
    try {
      parentSource = await this.sourceMaterialService.buildCellSourceMaterial(parentCell);
    } catch (error) {
      throw new Error(`LivingContextService: failed to collect source material`, {
        cause: error
      });
    }

    // 3. 建立 Prompt
    let prompt;
    try {
      prompt = buildLivingContextDivisionPrompt({
        parentSource,
        dnaDivisionPlan,
        childId
      });
    } catch (error) {
      throw new Error(`LivingContextService: failed to build prompt`, {
        cause: error
      });
    }

    // 4. 呼叫 AI (timeout 180秒)
    let rawResponse;
    try {
      rawResponse = await this.requesterCell.askWithTimeout(prompt, 300000);
    } catch (error) {
      throw new Error(`LivingContextService: AI division planning failed`, {
        cause: error
      });
    }

    // 5. Parse JSON
    let parsed;
    try {
      parsed = this._parseDivisionPlanResponse(rawResponse);
    } catch (error) {
      throw new Error(`LivingContextService: failed to parse division plan`, {
        cause: error
      });
    }

    // 6. 強制覆蓋系統決定的 ID（不相信 AI 回傳的 ID）
    parsed.type = "living-context-division";
    parsed.parentCellId = parentCell.id;
    parsed.childCellId = childId;

    // 7. 正規化
    let normalized;
    try {
      normalized = normalizeDivisionPlan(parsed);
    } catch (error) {
      throw new Error(`LivingContextService: failed to normalize division plan`, {
        cause: error
      });
    }

    // 8. 驗證
    const validation = validateDivisionPlan(normalized);
    if (!validation.valid) {
      throw new Error(
        `LivingContextService: invalid division plan: ${validation.errors.join("; ")}`
      );
    }

    // 9. 驗證 sourceArtifactIds
    this._validateSourceArtifactIds(normalized, parentSource);

    // 10. 回傳正規化後的 Plan
    return normalized;
  }

  /**
   * 解析 AI 回傳的 Division Plan
   * @private
   */
  _parseDivisionPlanResponse(raw) {
    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw)
    ) {
      return raw;
    }

    if (typeof raw !== "string") {
      throw new Error(
        "AI response must be a string or object"
      );
    }

    let cleaned = raw.trim();

    if (!cleaned) {
      throw new Error(
        "AI response is empty"
      );
    }

    // 移除 Markdown code fence
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const firstBrace =
      cleaned.indexOf("{");

    const lastBrace =
      cleaned.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1 ||
      firstBrace >= lastBrace
    ) {
      const preview =
        cleaned.substring(0, 500);

      throw new Error(
        [
          "No valid JSON object found in AI response.",
          `Preview: ${preview}`,
          cleaned.length > 500 ? "..." : "",
        ].join(" ")
      );
    }

    const jsonStr = cleaned.substring(
      firstBrace,
      lastBrace + 1
    );

    try {
      const parsed =
        JSON.parse(jsonStr);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error(
          "Parsed division plan must be a JSON object"
        );
      }

      return parsed;
    } catch (parseError) {
      const preview =
        jsonStr.substring(0, 500);

      throw new Error(
        [
          "Failed to parse JSON.",
          `Preview: ${preview}`,
          jsonStr.length > 500 ? "..." : "",
        ].join(" "),
        {
          cause: parseError,
        }
      );
    }
  }

  /**
   * 驗證 sourceArtifactIds 是否存在於 Parent 的 Artifact Catalog
   * @private
   */
  _validateSourceArtifactIds(plan, parentSource) {
    const validArtifactIds = new Set(
      (parentSource.artifactCatalog || []).map(artifact => artifact.artifactId)
    );

    const errors = [];

    if (Array.isArray(plan.productionPlan)) {
      plan.productionPlan.forEach((item, index) => {
        if (Array.isArray(item.sourceArtifactIds)) {
          item.sourceArtifactIds.forEach(artifactId => {
            if (!validArtifactIds.has(artifactId)) {
              errors.push(
                `productionPlan[${index}].sourceArtifactIds contains unknown artifact: ${artifactId}`
              );
            }
          });
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Invalid division plan: ${errors.join("; ")}`);
    }
  }
}

