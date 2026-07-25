import assert from "assert";
import {
  renderDNAHistory,
  renderLifecycleDecision,
  renderMaturityInfo,
} from "../src/commands/cell-status-renderer.js";

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

const emptyHistory = captureConsole(() => renderDNAHistory([]));
assert.ok(emptyHistory.includes("(empty dna history)"));

const history = captureConsole(() => {
  renderDNAHistory([
    { at: "2026-07-24T10:00:00.000Z", reason: "prepare" },
    { at: "2026-07-24T10:05:00.000Z", reason: "evolve" },
  ]);
});
assert.ok(history.includes("[1] 2026-07-24T10:00:00.000Z (prepare)"));
assert.ok(history.includes("[2] 2026-07-24T10:05:00.000Z (evolve)"));

const maturity = captureConsole(() => {
  renderMaturityInfo({
    percent: 72,
    state: "stable",
    sampleSize: 7,
    magnitude: 2.12345,
    normalizedMagnitude: 0.61234,
    temporalVariance: 0.012345,
    convergence: 0.98765,
    currentTraitScores: {
      CREATION: 0.81234,
    },
  });
});
assert.ok(maturity.includes("DNA Maturity"));
assert.ok(maturity.includes("Maturity       : 72%"));
assert.ok(maturity.includes("Magnitude      : 2.1235"));
assert.ok(maturity.includes("CREATION            : 0.8123"));

const lifecycle = captureConsole(() => {
  renderLifecycleDecision({
    cell: { id: "cell-001" },
    maturity: {
      percent: 72,
      state: "stable",
      sampleSize: 7,
      temporalVariance: 0.012345,
      convergence: 0.98765,
      normalizedMagnitude: 0.61234,
    },
    decision: {
      action: "repair",
      confidence: "medium",
      reason: "variance rising",
      detail: {
        score: 0.1234567,
        nested: { issue: "artifact" },
        text: "keep watching",
      },
    },
  });
});
assert.ok(lifecycle.includes("Cell Lifecycle Decision"));
assert.ok(lifecycle.includes("Cell             : cell-001"));
assert.ok(lifecycle.includes("Action           : repair"));
assert.ok(lifecycle.includes("- score                    : 0.123457"));
assert.ok(lifecycle.includes('- nested                   : {"issue":"artifact"}'));
assert.ok(lifecycle.includes("- text                     : keep watching"));

console.log("Cell status renderer tests passed");
