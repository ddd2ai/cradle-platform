/**
 * Execution Stimulus
 *
 * 將 ExecutionResult 轉換為 Stimulus
 *
 * 職責:
 * 1. 分類 ExecutionResult (signals vs threats)
 * 2. 產生 Stimulus markdown 內容
 * 3. 提供執行結果的語意化摘要
 */

/**
 * 分類 ExecutionResult
 *
 * @param {ExecutionResult} result
 * @returns {string} - "signals" | "threats"
 */
export function classifyExecutionStimulus(result) {
  if (result.status === "passed") {
    return "signals";
  }

  if (
    result.status === "compile_failed" ||
    result.status === "runtime_failed" ||
    result.status === "error"
  ) {
    return "threats";
  }

  return "signals";
}

/**
 * 產生執行結果摘要
 *
 * @param {ExecutionResult} result
 * @returns {string}
 */
function summarizeExecutionResult(result) {
  if (result.status === "passed") {
    return "Artifact execution passed. The produced artifact can run successfully.";
  }

  if (result.status === "compile_failed") {
    return "Artifact failed during compilation. The generated source code may be structurally invalid.";
  }

  if (result.status === "runtime_failed") {
    return "Artifact compiled but failed during runtime. The behavior or runtime assumptions may be incorrect.";
  }

  if (result.status === "error") {
    return "Artifact execution failed before normal execution completed. The execution pipeline or environment may be invalid.";
  }

  return "Artifact execution produced an unknown result.";
}

/**
 * 建構 Execution Stimulus
 *
 * @param {Object} options
 * @param {string} options.cellId
 * @param {string} options.artifactId
 * @param {ExecutionResult|Object} options.executionResult
 * @returns {Object} - { category, content }
 */
export function buildExecutionStimulus({ cellId, artifactId, executionResult } = {}) {
  const category = classifyExecutionStimulus(executionResult);

  const summary = summarizeExecutionResult(executionResult);

  const content = `# Execution Stimulus

## Source

internal.execution

## Cell

${cellId}

## Artifact

${artifactId}

## Execution

${executionResult.executionId ?? "-"}

## Status

${executionResult.status}

## Summary

${summary}

## Command

${executionResult.command || "-"}

## Exit Code

${executionResult.exitCode ?? "-"}

## Stdout

\`\`\`text
${executionResult.stdout || ""}
\`\`\`

## Stderr

\`\`\`text
${executionResult.stderr || ""}
\`\`\`

## Error

\`\`\`text
${executionResult.error || ""}
\`\`\`

## Suggested Perception

請判斷這次執行結果對 Cell 的影響：

- 是否代表 artifact 成功產生價值
- 是否代表 production pipeline 需要修正
- 是否需要建立 repair task
- 是否影響 CREATION、PERCEPTION、REFLECTION 或 EVOLUTION DNA

---
createdAt: ${new Date().toISOString()}
`;

  return {
    category,
    content,
  };
}
