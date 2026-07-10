/**
 * source-material-service.js
 * 
 * 收集與整理 Cell 的 Source Material
 * 用於 AI Transformation Plan 生成
 */

import path from "path";
import fs from "fs/promises";

export class SourceMaterialService {
  /**
   * 建構完整的 Cell Source Material
   * 
   * @param {Object} cell - CradleCell 實例
   * @returns {Promise<Object>} Source Material
   */
  async buildCellSourceMaterial(cell) {
    // 讀取基本資訊
    const profile = await cell.readProfile();
    const livingContext = await cell.readLivingContext();
    const dnaVector = await cell.readDNAVector();

    // 讀取 responsibilities
    let responsibilities = [];
    try {
      const responsibilitiesPath = path.join(cell.memoryDir, "responsibilities.json");
      const raw = await fs.readFile(responsibilitiesPath, "utf8");
      responsibilities = JSON.parse(raw);
    } catch (error) {
      // 如果沒有 responsibilities.json，從 profile 中讀取
      if (profile.responsibilities) {
        responsibilities = profile.responsibilities;
      }
    }

    // 讀取 Memory (限制大小)
    const memory = await this.buildDistilledMemory(cell);

    // 建立 Artifact Catalog
    const catalogResult = await this.buildArtifactCatalog(cell);

    // 讀取 relationships
    let relationships = [];
    try {
      relationships = await cell.getRelationships();
    } catch (error) {
      // relationships 可能不存在
    }

    return {
      cellId: cell.id,
      profile,
      livingContext,
      dnaVector,
      responsibilities,
      relationships,
      memory,
      artifactCatalog: catalogResult.artifacts,
      artifactCatalogErrors: catalogResult.errors
    };
  }

  /**
   * 建立 Distilled Memory (限制大小)
   */
  async buildDistilledMemory(cell) {
    const memory = {
      identity: "",
      rules: "",
      knowledge: "",
      recentHistory: "",
      recentThoughts: ""
    };

    // Identity
    try {
      memory.identity = await cell.readMemory("identity");
      memory.identity = this.truncate(memory.identity, 2000);
    } catch (error) {
      // identity 可能不存在
    }

    // Rules
    try {
      memory.rules = await cell.readMemory("rules");
      memory.rules = this.truncate(memory.rules, 3000);
    } catch (error) {
      // rules 可能不存在
    }

    // Knowledge (最多 12000 chars)
    try {
      memory.knowledge = await cell.readMemory("knowledge");
      memory.knowledge = this.truncate(memory.knowledge, 12000);
    } catch (error) {
      // knowledge 可能不存在
    }

    // Recent History (最多 8000 chars)
    try {
      const fullHistory = await cell.readMemory("history");
      memory.recentHistory = this.getRecentContent(fullHistory, 8000);
    } catch (error) {
      // history 可能不存在
    }

    // Recent Thoughts (最多 5000 chars)
    try {
      const thoughtsPath = path.join(cell.thoughtsDir, "thoughts.md");
      const fullThoughts = await fs.readFile(thoughtsPath, "utf8");
      memory.recentThoughts = this.getRecentContent(fullThoughts, 5000);
    } catch (error) {
      // thoughts 可能不存在
    }

    return memory;
  }

  /**
   * 建立 Artifact Catalog (只有 metadata，不載入完整內容)
   * 
   * @param {Object} cell - CradleCell 實例
   * @returns {Promise<Object>} { artifacts: [...], errors: [...] }
   */
  async buildArtifactCatalog(cell) {
    if (!cell.artifactStore) {
      return { artifacts: [], errors: [] };
    }

    try {
      const result = await cell.artifactStore.listArtifactSummaries();
      return {
        artifacts: result.artifacts || [],
        errors: result.errors || []
      };
    } catch (error) {
      console.warn(`buildArtifactCatalog: Failed to list artifacts for ${cell.id}:`, error.message);
      return { artifacts: [], errors: [] };
    }
  }

  /**
   * 載入選定的 Artifacts (限制內容大小)
   * 
   * @param {Object} cell - CradleCell 實例
   * @param {string[]} artifactIds - Artifact IDs
   * @returns {Promise<Object>} { artifacts: [...], errors: [...] }
   */
  async loadSelectedArtifacts(
    cell,
    artifactIds = []
    ) {
    if (
        !cell.artifactStore ||
        !Array.isArray(artifactIds) ||
        artifactIds.length === 0
    ) {
        return {
        artifacts: [],
        errors: [],
        };
    }

    const artifacts = [];
    const errors = [];

    const MAX_OUTPUT_SIZE = 8000;
    const MAX_TOTAL_CONTENT_SIZE = 30000;

    let totalContentSize = 0;

    for (const artifactId of artifactIds) {
        if (
        totalContentSize >=
        MAX_TOTAL_CONTENT_SIZE
        ) {
        errors.push({
            artifactId,
            error:
            "Total artifact content exceeded limit",
        });

        break;
        }

        try {
        const sourceArtifact =
            await cell.artifactStore.readArtifact(
            artifactId
            );

        // 避免修改 ArtifactStore 回傳的原始物件
        const artifact =
            structuredClone(sourceArtifact);

        if (Array.isArray(artifact.outputs)) {
            artifact.outputs =
            artifact.outputs.map((output) => {
                if (
                typeof output.content !== "string"
                ) {
                return output;
                }

                const remainingTotalSize =
                MAX_TOTAL_CONTENT_SIZE -
                totalContentSize;

                const allowedSize = Math.min(
                MAX_OUTPUT_SIZE,
                remainingTotalSize
                );

                if (allowedSize <= 0) {
                return {
                    ...output,
                    content: "",
                    truncated: true,
                };
                }

                const originalContent =
                output.content;

                const limitedContent =
                this.truncate(
                    originalContent,
                    allowedSize
                );

                totalContentSize +=
                limitedContent.length;

                return {
                ...output,
                content: limitedContent,

                truncated:
                    limitedContent.length <
                    originalContent.length,
                };
            });
        }

        artifacts.push(artifact);
        } catch (error) {
        errors.push({
            artifactId,
            error: error.message,
        });
        }
    }

    return {
        artifacts,
        errors,
    };
    }

  /**
   * 截斷文字到指定長度
   */
  truncate(
    text,
    maxLength,
    marker = "\n\n[truncated]"
    ) {
    if (typeof text !== "string" || !text) {
        return "";
    }

    if (!Number.isInteger(maxLength) || maxLength < 0) {
        throw new Error(
        "truncate: maxLength must be a non-negative integer"
        );
    }

    if (text.length <= maxLength) {
        return text;
    }

    // maxLength 太小，連完整 marker 都放不下
    if (maxLength <= marker.length) {
        return marker.slice(0, maxLength);
    }

    const availableContentLength =
        maxLength - marker.length;

    return (
        text.slice(0, availableContentLength) +
        marker
    );
}

  /**
   * 取得最近的內容 (從尾端開始取)
   */
  getRecentContent(
    text,
    maxLength,
    marker = "[...earlier content truncated]\n\n"
    ) {
    if (typeof text !== "string" || !text) {
        return "";
    }

    if (!Number.isInteger(maxLength) || maxLength < 0) {
        throw new Error(
        "getRecentContent: maxLength must be a non-negative integer"
        );
    }

    if (text.length <= maxLength) {
        return text;
    }

    if (maxLength <= marker.length) {
        return marker.slice(0, maxLength);
    }

    const availableContentLength =
        maxLength - marker.length;

    const recentContent =
        text.slice(-availableContentLength);

    return marker + recentContent;
    }
}
