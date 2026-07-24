import assert from "assert";
import { renderStabilityState } from "../src/commands/stability-state-renderer.js";

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
  renderStabilityState({
    status: "repairing",
    consecutivePassed: 1,
    consecutiveNoTask: 0,
    repairCount: 2,
    updatedAt: "2026-07-24T10:00:00.000Z",
    stableAt: null,
    records: [
      {
        round: 1,
        executionStatus: "runtime_failed",
        createdTasks: 2,
        observationFile: "runtime/artifact-001.md",
        createdAt: "2026-07-24T09:00:00.000Z",
      },
      {
        round: 2,
        executionStatus: "passed",
        createdTasks: 0,
        observationFile: null,
        createdAt: "2026-07-24T10:00:00.000Z",
      },
    ],
  })
);

assert.ok(output.includes("Status               : repairing"));
assert.ok(output.includes("Consecutive Passed   : 1"));
assert.ok(output.includes("Repair Count         : 2"));
assert.ok(output.includes("Observation: runtime/artifact-001.md"));
assert.ok(output.includes("Observation: -"));
assert.equal(output.includes("Stable At"), false);

console.log("Stability state renderer tests passed");
