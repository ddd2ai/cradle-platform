import assert from "assert";
import { renderStabilizationResult } from "../src/commands/stabilization-result-renderer.js";

function captureConsole(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  try {
    fn();
    return output.join("\n");
  } finally {
    console.log = originalLog;
  }
}

const output = captureConsole(() =>
  renderStabilizationResult({
    artifactId: "artifact-001",
    stable: false,
    history: [
      {
        round: 1,
        executionStatus: "runtime_failed",
        createdTasks: 2,
        observationFile: "runtime/artifact-001.md",
        newTasks: [{ title: "Fix runtime error" }],
      },
      {
        round: 2,
        executionStatus: "passed",
        createdTasks: 0,
        observationFile: null,
        newTasks: [],
      },
    ],
  })
);

assert.ok(output.includes("Stabilization completed."));
assert.ok(output.includes("Artifact : artifact-001"));
assert.ok(output.includes("Stable   : no"));
assert.ok(output.includes("Rounds   : 2"));
assert.ok(output.includes("Fix runtime error"));
assert.ok(output.includes("tasks          : -"));

console.log("Stabilization result renderer tests passed");
