import assert from "assert";
import {
  evaluateStimulusAdmission,
  evaluateStimulusBatch,
} from "../src/situation/stimulus-salience-policy.js";

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

const passiveEnvelope = {
  schemaVersion: 1,
  stimulusId: "stim-passive",
  source: "internal.execution",
  facts: { artifactId: "artifact-001", status: "passed" },
};
assert.deepEqual(evaluateStimulusAdmission(passiveEnvelope), {
  decision: "summary-only",
  activate: false,
  reason: "successful execution evidence can be aggregated deterministically",
});
assert.equal(evaluateStimulusAdmission({ content: "unknown signal" }).activate, true);

const mixed = evaluateStimulusBatch([
  { envelope: passiveEnvelope },
  executionStimulus("runtime_failed"),
]);
assert.equal(mixed.processing, "reasoning");
assert.equal(mixed.summaryStimuli.length, 1);
assert.equal(mixed.reasoningStimuli.length, 1);
assert.equal(mixed.summaryObservation.facts[0], "artifact-001: passed");

console.log("Stimulus salience policy tests passed");
