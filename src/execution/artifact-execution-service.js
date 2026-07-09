import path from "path";
import { JavaExecutor } from "./java-executor.js";
import { ArtifactStore } from "../production/artifact-store.js";
import { ExecutionResult } from "./execution-result.js";

/**
 * ArtifactExecutionService
 * 
 * 統籌 Artifact 執行流程
 * 
 * 職責:
 * 1. 載入 artifact
 * 2. 根據 artifact type 或 language 選擇對應的 executor
 * 3. 執行並回傳執行結果
 * 4. 儲存 execution-result.json
 */
export class ArtifactExecutionService {
  constructor({ cellWorkspaceDir }) {
    this.cellWorkspaceDir = cellWorkspaceDir;
    this.artifactsDir = path.join(cellWorkspaceDir, "artifacts");
    this.executionsDir = path.join(cellWorkspaceDir, "executions");

    this.artifactStore = new ArtifactStore({ artifactsDir: this.artifactsDir });
    this.javaExecutor = new JavaExecutor({ executionsDir: this.executionsDir });
  }

  /**
   * 執行指定 artifact
   * 
   * @param {string} artifactId - Artifact ID
   * @returns {Promise<ExecutionResult>}
   */
  async executeArtifact(artifactId) {
    try {
      // 載入 artifact
      const artifact = await this.artifactStore.loadArtifact(artifactId);

      if (!artifact) {
        throw new Error(`Artifact not found: ${artifactId}`);
      }

      // 根據 artifact type 或 language 選擇 executor
      const executor = this.selectExecutor(artifact);

      if (!executor) {
        throw new Error(
          `No executor available for artifact type: ${artifact.type}`
        );
      }

      // 執行
      const result = await executor.execute({ artifact });

      return result;
    } catch (error) {
      return ExecutionResult.createError({
        artifactId,
        error,
        executionId: `execution-${Date.now()}`,
      });
    }
  }

  /**
   * 根據 artifact 選擇對應的 executor
   * 
   * @param {Object} artifact
   * @returns {Object|null}
   */
  selectExecutor(artifact) {
    // 優先檢查 artifact type
    if (artifact.type === "executable-java") {
      return this.javaExecutor;
    }

    // 檢查 outputs 的 language
    const hasJava = artifact.outputs?.some(
      (output) => output.language === "java" && output.path?.endsWith(".java")
    );

    if (hasJava) {
      return this.javaExecutor;
    }

    // 未來可以加入其他 executor
    // if (artifact.type === "executable-python") {
    //   return this.pythonExecutor;
    // }

    return null;
  }
}
