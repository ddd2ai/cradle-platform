import assert from "assert";
import {
  renderDivisionBeforeChildFailure,
  renderDivisionReadiness,
  renderDivisionResult,
} from "../src/commands/division-renderer.js";

function captureConsole(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return output.join("\n");
}

const readiness = captureConsole(() => {
  renderDivisionReadiness({
    parent: { id: "cell-001" },
    childId: "cell-002",
    maturity: {
      percent: 82,
      state: "mature",
      sampleSize: 8,
      normalizedMagnitude: 0.7123,
      temporalVariance: 0.012345,
      convergence: 0.9876,
    },
    decision: {
      action: "divide",
      reason: "ready",
    },
  });
});

assert.ok(readiness.includes("Division Readiness"));
assert.ok(readiness.includes("Parent           : cell-001"));
assert.ok(readiness.includes("Child            : cell-002"));
assert.ok(readiness.includes("Lifecycle Action : divide"));

const failure = captureConsole(() => {
  renderDivisionBeforeChildFailure({
    errors: [
      {
        stage: "planning",
        message: "missing child plan",
      },
    ],
  });
});

assert.ok(failure.includes("Division failed before child creation"));
assert.ok(failure.includes("- planning: missing child plan"));

const result = captureConsole(() => {
  renderDivisionResult({
    parent: { id: "cell-001" },
    result: {
      child: { id: "cell-002" },
      dnaDivisionPlan: { role: "Creation Cell" },
      livingContextPlan: {
        childLivingContext: {
          purpose: "create artifacts",
          responsibilities: ["creation"],
        },
        revisedParentLivingContext: {
          responsibilities: ["decision"],
        },
      },
      productionResult: {
        complete: false,
        produced: [
          {
            artifactId: "artifact-child-1234567890",
            title: "Child artifact",
          },
        ],
        parentRevisions: [
          {
            artifactId: "artifact-parent-1234567890",
            title: "Parent artifact",
          },
        ],
        failed: [
          {
            artifactId: "artifact-failed",
          },
        ],
      },
      complete: false,
      errors: [
        {
          stage: "production",
          message: "one artifact failed",
        },
      ],
    },
  });
});

assert.ok(result.includes("Living Context Division Complete"));
assert.ok(result.includes("Role          : Creation Cell"));
assert.ok(result.includes("Planned       : 3"));
assert.ok(result.includes("Status        : incomplete"));
assert.ok(result.includes("production: one artifact failed"));

console.log("Division renderer tests passed");
