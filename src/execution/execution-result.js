/**
 * ExecutionResult 資料模型
 * 
 * 定義 artifact 執行結果的資料結構
 */

export class ExecutionResult {
  constructor({
    artifactId,
    status,
    command,
    stdout = "",
    stderr = "",
    exitCode = null,
    error = null,
    executionId = null,
    createdAt = new Date().toISOString(),
  }) {
    this.artifactId = artifactId;
    this.status = status; // "passed" | "compile_failed" | "runtime_failed" | "error"
    this.command = command;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
    this.error = error;
    this.executionId = executionId;
    this.createdAt = createdAt;
  }

  static createPassed({ artifactId, command, stdout, exitCode, executionId }) {
    return new ExecutionResult({
      artifactId,
      status: "passed",
      command,
      stdout,
      exitCode,
      executionId,
    });
  }

  static createCompileFailed({ artifactId, command, stderr, executionId }) {
    return new ExecutionResult({
      artifactId,
      status: "compile_failed",
      command,
      stderr,
      exitCode: 1,
      executionId,
    });
  }

  static createRuntimeFailed({ artifactId, command, stdout, stderr, exitCode, executionId }) {
    return new ExecutionResult({
      artifactId,
      status: "runtime_failed",
      command,
      stdout,
      stderr,
      exitCode,
      executionId,
    });
  }

  static createError({ artifactId, error, executionId }) {
    return new ExecutionResult({
      artifactId,
      status: "error",
      command: "",
      error: error.message,
      executionId,
    });
  }

  toJSON() {
    return {
      artifactId: this.artifactId,
      status: this.status,
      command: this.command,
      stdout: this.stdout,
      stderr: this.stderr,
      exitCode: this.exitCode,
      error: this.error,
      executionId: this.executionId,
      createdAt: this.createdAt,
    };
  }
}
