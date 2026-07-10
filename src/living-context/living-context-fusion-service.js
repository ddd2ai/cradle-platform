/**
 * Living Context Fusion Service
 *
 * 整合多個 Parent Cells 的 Living Context，
 * 並透過 AI 產生 Living Context Fusion Plan。
 */

import { SourceMaterialService } from "./source-material-service.js";
import {
  buildLivingContextFusionPrompt,
} from "./living-context-fusion-prompts.js";
import {
  normalizeFusionPlan,
  validateFusionPlan,
} from "./fusion-plan-schema.js";

export class LivingContextFusionService {
  /**
   * @param {object} options
   * @param {object} [options.requesterCell]
   * @param {SourceMaterialService} [options.sourceMaterialService]
   */
  constructor({
    requesterCell,
    sourceMaterialService,
  } = {}) {
    this.requesterCell = requesterCell;

    this.sourceMaterialService =
      sourceMaterialService ??
      new SourceMaterialService();
  }

  /**
   * 建立 Living Context Fusion Plan。
   *
   * @param {object} options
   * @param {Array<object>} options.parentCells
   * @param {string} options.childId
   * @param {object} options.dnaFusionPlan
   * @returns {Promise<object>}
   */
  async createFusionPlan({
    parentCells,
    childId,
    dnaFusionPlan,
  }) {
    this.validateInput(
      parentCells,
      childId,
      dnaFusionPlan
    );

    const requester =
      this.requesterCell ??
      parentCells[0];

    if (
      !requester ||
      typeof requester.askWithTimeout !== "function"
    ) {
      throw new Error(
        "LivingContextFusionService: requesterCell.askWithTimeout is required"
      );
    }

    const parentSources =
      await this.collectParentSources(
        parentCells
      );

    let prompt;

    try {
      prompt =
        buildLivingContextFusionPrompt({
          parentSources,
          dnaFusionPlan,
          childId,
        });
    } catch (error) {
      throw new Error(
        "LivingContextFusionService: failed to build fusion prompt",
        {
          cause: error,
        }
      );
    }

    let aiResponse;

    try {
      aiResponse =
        await requester.askWithTimeout(
          prompt,
          180000
        );
    } catch (error) {
      throw new Error(
        "LivingContextFusionService: AI fusion planning failed",
        {
          cause: error,
        }
      );
    }

    let parsedPlan;

    try {
      parsedPlan =
        this._parseFusionPlanResponse(
          aiResponse
        );
    } catch (error) {
      throw new Error(
        "LivingContextFusionService: failed to parse fusion plan",
        {
          cause: error,
        }
      );
    }

    /*
     * 系統欄位不可相信 AI 回傳值。
     * 一律使用實際輸入覆蓋。
     */
    parsedPlan.type =
      "living-context-fusion";

    parsedPlan.parentCellIds =
      parentCells.map(
        cell => cell.id
      );

    parsedPlan.childCellId =
      childId;

    let normalized;

    try {
      normalized =
        normalizeFusionPlan(
          parsedPlan
        );
    } catch (error) {
      throw new Error(
        "LivingContextFusionService: failed to normalize fusion plan",
        {
          cause: error,
        }
      );
    }

    const validation =
      validateFusionPlan(
        normalized
      );

    if (!validation.valid) {
      throw new Error(
        [
          "LivingContextFusionService: invalid fusion plan:",
          validation.errors.join("; "),
        ].join(" ")
      );
    }

    this.validateSourceArtifacts(
      normalized,
      parentSources
    );

    return normalized;
  }

  /**
   * 解析 AI 回傳的 Fusion Plan。
   *
   * 支援：
   * - 直接回傳 object
   * - { text: "JSON" }
   * - Markdown code fence
   * - JSON 前後包含說明文字
   *
   * @param {unknown} raw
   * @returns {object}
   * @private
   */
  _parseFusionPlanResponse(raw) {
    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw)
    ) {
      /*
       * Copilot 或其他 Provider
       * 可能回傳 { text: "..." }。
       */
      if (
        typeof raw.text === "string"
      ) {
        return this._parseFusionPlanResponse(
          raw.text
        );
      }

      return raw;
    }

    if (typeof raw !== "string") {
      throw new Error(
        "AI response must be a string or object"
      );
    }

    let cleaned =
      raw.trim();

    if (!cleaned) {
      throw new Error(
        "AI response is empty"
      );
    }

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
      throw new Error(
        [
          "No valid JSON object found in AI response.",
          `Preview: ${this._createPreview(cleaned)}`,
        ].join(" ")
      );
    }

    const jsonText =
      cleaned.substring(
        firstBrace,
        lastBrace + 1
      );

    try {
      const parsed =
        JSON.parse(jsonText);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error(
          "Parsed fusion plan must be a JSON object"
        );
      }

      return parsed;
    } catch (error) {
      throw new Error(
        [
          "Failed to parse fusion plan JSON.",
          `Preview: ${this._createPreview(jsonText)}`,
        ].join(" "),
        {
          cause: error,
        }
      );
    }
  }

  /**
   * 建立錯誤訊息用的內容預覽。
   *
   * @param {string} value
   * @returns {string}
   * @private
   */
  _createPreview(value) {
    const maxLength = 500;

    const preview =
      value.substring(
        0,
        maxLength
      );

    return value.length > maxLength
      ? `${preview}...`
      : preview;
  }

  /**
   * 驗證建立 Fusion Plan 所需參數。
   *
   * @param {Array<object>} parentCells
   * @param {string} childId
   * @param {object} dnaFusionPlan
   */
  validateInput(
    parentCells,
    childId,
    dnaFusionPlan
  ) {
    if (
      !Array.isArray(parentCells) ||
      parentCells.length < 2
    ) {
      throw new Error(
        "LivingContextFusionService: parentCells must have at least 2 items"
      );
    }

    for (
      let index = 0;
      index < parentCells.length;
      index++
    ) {
      const cell =
        parentCells[index];

      if (!cell) {
        throw new Error(
          `LivingContextFusionService: parentCells[${index}] is required`
        );
      }

      if (
        typeof cell.id !== "string" ||
        cell.id.trim() === ""
      ) {
        throw new Error(
          `LivingContextFusionService: parentCells[${index}].id must be a non-empty string`
        );
      }
    }

    const parentIds =
      parentCells.map(
        cell => cell.id
      );

    const uniqueIds =
      new Set(parentIds);

    if (
      uniqueIds.size !==
      parentIds.length
    ) {
      throw new Error(
        "LivingContextFusionService: parentCells must not contain duplicate IDs"
      );
    }

    if (
      typeof childId !== "string" ||
      childId.trim() === ""
    ) {
      throw new Error(
        "LivingContextFusionService: childId must be a non-empty string"
      );
    }

    if (
      parentIds.includes(
        childId
      )
    ) {
      throw new Error(
        "LivingContextFusionService: childId must not equal a parent cell ID"
      );
    }

    if (
      !dnaFusionPlan ||
      typeof dnaFusionPlan !== "object" ||
      Array.isArray(dnaFusionPlan)
    ) {
      throw new Error(
        "LivingContextFusionService: dnaFusionPlan is required"
      );
    }
  }

  /**
   * 收集所有 Parent Cell 的 Source Material。
   *
   * 採序列執行，避免 Provider 或檔案操作發生競爭。
   *
   * @param {Array<object>} parentCells
   * @returns {Promise<Array<object>>}
   */
  async collectParentSources(
    parentCells
  ) {
    const sources = [];

    for (const cell of parentCells) {
      try {
        const source =
          await this.sourceMaterialService
            .buildCellSourceMaterial(
              cell
            );

        sources.push(source);
      } catch (error) {
        throw new Error(
          [
            "LivingContextFusionService:",
            "failed to collect source material",
            `for cell ${cell.id}`,
          ].join(" "),
          {
            cause: error,
          }
        );
      }
    }

    return sources;
  }

  /**
   * 驗證 Fusion Plan 使用的 Source Artifacts
   * 是否存在於對應 Parent Cell。
   *
   * @param {object} plan
   * @param {Array<object>} parentSources
   */
  validateSourceArtifacts(
    plan,
    parentSources
  ) {
    const artifactMap =
      new Map();

    for (const source of parentSources) {
      const artifactIds =
        new Set();

      const artifactCatalog =
        Array.isArray(
          source.artifactCatalog
        )
          ? source.artifactCatalog
          : [];

      for (
        const artifact of artifactCatalog
      ) {
        /*
         * SourceMaterialService 的標準欄位
         * 應統一使用 artifactId。
         */
        if (
          typeof artifact.artifactId === "string" &&
          artifact.artifactId.trim() !== ""
        ) {
          artifactIds.add(
            artifact.artifactId
          );
        }
      }

      artifactMap.set(
        source.cellId,
        artifactIds
      );
    }

    const productionPlan =
      Array.isArray(plan.productionPlan)
        ? plan.productionPlan
        : [];

    const errors = [];

    productionPlan.forEach(
      (item, itemIndex) => {
        const sourceArtifacts =
          Array.isArray(
            item.sourceArtifacts
          )
            ? item.sourceArtifacts
            : [];

        sourceArtifacts.forEach(
          (artifactRef, artifactIndex) => {
            const cellId =
              artifactRef.cellId;

            const artifactId =
              artifactRef.artifactId;

            if (
              !artifactMap.has(cellId)
            ) {
              errors.push(
                [
                  `productionPlan[${itemIndex}]`,
                  `.sourceArtifacts[${artifactIndex}]`,
                  "contains unknown cell:",
                  `${cellId}/${artifactId}`,
                ].join("")
              );

              return;
            }

            const artifactIds =
              artifactMap.get(cellId);

            if (
              !artifactIds.has(
                artifactId
              )
            ) {
              errors.push(
                [
                  `productionPlan[${itemIndex}]`,
                  `.sourceArtifacts[${artifactIndex}]`,
                  " contains unknown artifact: ",
                  `${cellId}/${artifactId}`,
                ].join("")
              );
            }
          }
        );
      }
    );

    if (errors.length > 0) {
      throw new Error(
        [
          "LivingContextFusionService: invalid fusion plan:",
          errors.join("; "),
        ].join(" ")
      );
    }
  }
}