import { JavaExecutor } from "./java-executor.js";
import { MavenExecutor } from "./maven-executor.js";
import { ArtifactStore } from "../production/artifact-store.js";
import { ExecutionResult } from "./execution-result.js";
import { ThreatStore } from "../heartbeat/threat-store.js";
import { getTimeoutMs } from "../cradle-config.js";

const FAILURE_STATUSES = new Set([
  "compile_failed",
  "runtime_failed",
  "error",
]);

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
  constructor({
    cellId = null,
    productionsDir,
    executionsDir,
    threatStore = new ThreatStore(),
  }) {
    if (!productionsDir) {
      throw new Error("ArtifactExecutionService requires productionsDir");
    }

    if (!executionsDir) {
      throw new Error("ArtifactExecutionService requires executionsDir");
    }

    this.cellId = cellId;
    this.productionsDir = productionsDir;
    this.executionsDir = executionsDir;
    this.threatStore = threatStore;

    this.artifactStore = new ArtifactStore({
      productionsDir: this.productionsDir,
    });

    this.javaExecutor = new JavaExecutor({
      executionsDir: this.executionsDir,
    });

    this.mavenExecutor = new MavenExecutor({
      executionsDir: this.executionsDir,
      timeoutMs: getTimeoutMs("mavenExecutionSeconds"),
    });
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
      const artifact = await this.artifactStore.readArtifact(artifactId);

      if (!artifact) {
        throw new Error(`Artifact not found: ${artifactId}`);
      }

      if (this.isNonExecutableArtifact(artifact)) {
        return ExecutionResult.createSkipped({
          artifactId,
          reason: `Artifact type "${artifact.type}" is not executable.`,
          executionId: `execution-${Date.now()}`,
        });
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

      await this.writeFailureThreatIfNeeded({
        artifact,
        result,
      });

      return result;
    } catch (error) {
      const result = ExecutionResult.createError({
        artifactId,
        error,
        executionId: `execution-${Date.now()}`,
      });

      await this.writeFailureThreatIfNeeded({
        artifact: { id: artifactId },
        result,
      });

      return result;
    }
  }

  async writeFailureThreatIfNeeded({ artifact, result }) {
    if (!FAILURE_STATUSES.has(result?.status)) {
      return null;
    }

    if (!this.cellId || !this.threatStore) {
      return null;
    }

    return await this.threatStore.saveExecutionFailure({
      cellId: this.cellId,
      artifactId: artifact.id,
      executionResult: result,
    });
  }

  /**
   * 根據 artifact 選擇對應的 executor
   * 
   * @param {Object} artifact
   * @returns {Object|null}
   */
  selectExecutor(artifact) {
    const outputs = artifact.outputs ?? [];

    // 目前 JavaExecutor 只支援單檔 executable-java
    if (artifact.type === "executable-java") {
      return this.javaExecutor;
    }

    // Maven 專案
    const hasPom = outputs.some(
      output =>
        output.kind === "file" &&
        output.path === "pom.xml"
    );

    if (artifact.type === "code" && hasPom) {
      return this.mavenExecutor;
    }

    // 可以增加更多 executor 的判斷邏輯，例如 PythonExecutor、NodeExecutor 等

    return null;
  }

  isNonExecutableArtifact(artifact) {
    const nonExecutableTypes = new Set([
      "document",
      "diagram",
      "prompt",
      "decision",
      "research",
      "spec",
      "task",
    ]);

    if (nonExecutableTypes.has(artifact.type)) {
      return true;
    }

    const outputs = artifact.outputs ?? [];
    const fileOutputs = outputs.filter((output) => output.kind === "file");

    return (
      artifact.type === "code" &&
      fileOutputs.length > 0 &&
      fileOutputs.every((output) => output.language === "markdown")
    );
  }
}
