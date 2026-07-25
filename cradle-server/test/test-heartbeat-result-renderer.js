import assert from "assert";
import { renderHeartbeatResult } from "../src/commands/heartbeat-result-renderer.js";

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

const blockedOutput = captureConsole(() => {
  renderHeartbeatResult({
    mode: "manual",
    action: "stay",
    blocked: [
      {
        proposal: {
          sourceCellId: "cell-001",
          action: "repair",
          repairType: "artifact",
        },
        policyDecision: {
          reasons: ["needs approval"],
        },
      },
    ],
  });
});
assert.ok(blockedOutput.includes("No executable proposal."));
assert.ok(blockedOutput.includes("cell-001 REPAIR / ARTIFACT"));
assert.ok(blockedOutput.includes("needs approval"));

const completedOutput = captureConsole(() => {
  renderHeartbeatResult({
    mode: "automatic",
    selected: {
      userDecision: { automatic: true },
      proposal: {
        sourceCellId: "cell-001",
        action: "divide",
        status: "completed",
        confidence: 0.91,
        reason: "ready",
      },
      policyDecision: {
        allowed: true,
        riskLevel: "low",
        warnings: [],
      },
    },
  });
});
assert.ok(completedOutput.includes("Automatic mode enabled."));
assert.ok(completedOutput.includes("Lifecycle action completed: divide"));

console.log("Heartbeat result renderer tests passed");
