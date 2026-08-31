import assert from "assert";
import { evaluateStimulusBatch } from "../src/situation/stimulus-salience-policy.js";

const executionStimulus = (status) => ({
  content: `# Execution Stimulus

## Source

internal.execution

## Artifact

artifact-001

## Status

${status}
`,
});

assert.equal(evaluateStimulusBatch([executionStimulus("passed")]).processing, "summary-only");
assert.equal(evaluateStimulusBatch([executionStimulus("skipped")]).processing, "summary-only");
assert.equal(evaluateStimulusBatch([executionStimulus("runtime_failed")]).processing, "reasoning");
assert.equal(evaluateStimulusBatch([{ content: "unknown signal" }]).processing, "reasoning");

console.log("Stimulus salience policy tests passed");
