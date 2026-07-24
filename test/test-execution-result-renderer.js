import assert from "assert";
import { renderExecutionResult } from "../src/commands/execution-result-renderer.js";

function captureConsole(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));
  console.error = (...args) => output.push(args.join(" "));

  try {
    fn();
    return output.join("\n");
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

const passedOutput = captureConsole(() =>
  renderExecutionResult({
    status: "passed",
    command: "node artifact.js",
    stdout: "ok",
    executionId: "exec-001",
    createdAt: "2026-07-24T10:00:00.000Z",
  })
);
assert.ok(passedOutput.includes("Status: PASSED"));
assert.ok(passedOutput.includes("指令: node artifact.js"));
assert.ok(passedOutput.includes("Output:"));
assert.ok(passedOutput.includes("Execution ID: exec-001"));

const runtimeOutput = captureConsole(() =>
  renderExecutionResult({
    status: "runtime_failed",
    stdout: "before failure",
    stderr: "boom",
    exitCode: 2,
  })
);
assert.ok(runtimeOutput.includes("Status: RUNTIME FAILED"));
assert.ok(runtimeOutput.includes("stdout:"));
assert.ok(runtimeOutput.includes("before failure"));
assert.ok(runtimeOutput.includes("stderr:"));
assert.ok(runtimeOutput.includes("boom"));
assert.ok(runtimeOutput.includes("Exit Code: 2"));

const unknownOutput = captureConsole(() =>
  renderExecutionResult({
    status: "custom_status",
  })
);
assert.ok(unknownOutput.includes("Status: custom_status"));

console.log("Execution result renderer tests passed");
