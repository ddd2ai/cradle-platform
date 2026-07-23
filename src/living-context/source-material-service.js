/**
 * source-material-service.js
 * 
 * 收集與整理 Cell 的 Source Material
 * 用於 AI Transformation Plan 生成
 */

import path from "path";
import fs from "fs/promises";
import {
  getAiMaxSourceArtifactOutputLength,
  getAiMaxSourceArtifactContentLength,
} from "../cradle-config.js";

export class SourceMaterialService {
  /**
   * 建構完整的 Cell Source Material
   * 
   * @param {Object} cell - CradleCell 實例
   * @returns {Promise<Object>} Source Material
   */
  async buildCellSourceMaterial(cell) {
    // 讀取基本資訊
    const profile = await cell.readCellProfile();
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
      if (Array.isArray(profile?.responsibilities)) {
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
      relationships = await cell.listRelationships();
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
      distilledMemory: memory,
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

    memory.identity =
      await this.readTruncatedMemory(cell, "identity", 2000);

    memory.rules =
      await this.readTruncatedMemory(cell, "rules", 3000);

    memory.knowledge =
      await this.readTruncatedMemory(cell, "knowledge", 12000);

    memory.recentHistory =
      await this.readRecentMemory(cell, "history", 8000);

    memory.recentThoughts =
      await this.readRecentThoughts(cell, 5000);

    return memory;
  }

  async readTruncatedMemory(cell, name, maxLength) {
    try {
      return this.truncate(
        await cell.readMemory(name),
        maxLength
      );
    } catch (error) {
      return "";
    }
  }

  async readRecentMemory(cell, name, maxLength) {
    try {
      return this.getRecentContent(
        await cell.readMemory(name),
        maxLength
      );
    } catch (error) {
      return "";
    }
  }

  async readRecentThoughts(cell, maxLength) {
    try {
      const thoughtsPath =
        path.join(cell.thoughtsDir, "thoughts.md");

      return this.getRecentContent(
        await fs.readFile(thoughtsPath, "utf8"),
        maxLength
      );
    } catch (error) {
      return "";
    }
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

    const maxOutputSize =
      getAiMaxSourceArtifactOutputLength();
    const maxTotalContentSize =
      getAiMaxSourceArtifactContentLength();

    let totalContentSize = 0;

    for (const artifactId of artifactIds) {
      if (totalContentSize >= maxTotalContentSize) {
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

        const limited =
          this.limitArtifactOutputs({
            artifact,
            maxOutputSize,
            maxTotalContentSize,
            currentTotalSize: totalContentSize,
          });

        totalContentSize = limited.totalContentSize;
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

  limitArtifactOutputs({
    artifact,
    maxOutputSize,
    maxTotalContentSize,
    currentTotalSize,
  }) {
    if (!Array.isArray(artifact.outputs)) {
      return {
        artifact,
        totalContentSize: currentTotalSize,
      };
    }

    let totalContentSize = currentTotalSize;

    artifact.outputs = artifact.outputs.map((output) => {
      if (typeof output.content !== "string") {
        return output;
      }

      const remainingTotalSize =
        maxTotalContentSize - totalContentSize;

      const allowedSize = Math.min(
        maxOutputSize,
        remainingTotalSize
      );

      const limitedOutput =
        this.limitArtifactOutputContent({
          output,
          allowedSize,
        });

      totalContentSize +=
        limitedOutput.content.length;

      return limitedOutput;
    });

    return {
      artifact,
      totalContentSize,
    };
  }

  limitArtifactOutputContent({
    output,
    allowedSize,
  }) {
    if (allowedSize <= 0) {
      return {
        ...output,
        content: "",
        truncated: true,
      };
    }

    const originalContent = output.content;
    const limitedContent =
      this.truncate(
        originalContent,
        allowedSize
      );

    return {
      ...output,
      content: limitedContent,

      truncated:
        limitedContent.length <
        originalContent.length,
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
