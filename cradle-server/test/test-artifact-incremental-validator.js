import assert from "node:assert/strict";
import { ArtifactIncrementalValidator } from "../src/production/artifact-incremental-validator.js";
import { ArtifactValidator } from "../src/production/artifact-validator.js";
import { buildArtifactOutputIndex } from "../src/production/artifact-content-index.js";
import { buildArtifactRepairHead } from "../src/production/artifact-impact-index.js";

const validator = new ArtifactIncrementalValidator({
  validator: new ArtifactValidator(),
});
const indexedContent = "export function calculateTotal() { return 1; }";
const indexedOutput = {
  kind: "file",
  path: "src/calculator.js",
  language: "javascript",
  contentHash: "hash",
  ...buildArtifactOutputIndex({
    content: indexedContent,
    indexedTerms: ["calculateTotal"],
  }),
};
const changedOutput = {
  kind: "file",
  path: "src/main.js",
  language: "javascript",
  content: "export function main() { return 2; }",
};
const artifact = {
  id: "artifact-validator",
  type: "code",
  title: "局部驗證",
  goal: "包含 calculateTotal 方法",
  outputs: [indexedOutput, changedOutput],
  notes: [],
};
const changePlan = {
  changes: [{ path: "src/main.js" }],
};

assert.deepEqual(
  validator.validate({ artifact, changePlan }),
  { requiresFullValidation: false }
);

const uncertain = validator.validate({
  artifact: {
    ...artifact,
    outputs: [
      {
        ...indexedOutput,
        contentTermHashes: [],
        contentTermIndexComplete: false,
      },
      changedOutput,
    ],
  },
  changePlan,
});
assert.equal(uncertain.requiresFullValidation, true);
assert.equal(uncertain.reason, "goal-term-not-proven:calculatetotal");

const headBaseOutputs = [
  {
    kind: "file",
    path: "src/a.js",
    language: "javascript",
    content: "export function run() { return 1; }",
  },
  {
    kind: "file",
    path: "src/main.js",
    language: "javascript",
    content: "export function main() { return 1; }",
  },
];
const headArtifact = {
  id: "artifact-head-validation",
  type: "code",
  title: "Head validation",
  goal: "包含 run 方法",
  revision: { revisionId: "rev-head-1" },
  outputs: headBaseOutputs,
  notes: [],
};
const head = buildArtifactRepairHead(headArtifact);
assert.deepEqual(
  validator.validate({
    artifact: {
      ...headArtifact,
      revision: {
        revisionId: "rev-head-2",
        baseRevisionId: "rev-head-1",
      },
      outputs: [{
        ...headBaseOutputs[1],
        content: "export function main() { return 2; }",
      }],
    },
    changePlan: { changes: [{ path: "src/main.js" }] },
    baseHead: head,
    baseOutputs: [headBaseOutputs[1]],
  }),
  { requiresFullValidation: false }
);
const removesFinalGoalTerm = validator.validate({
  artifact: {
    ...headArtifact,
    revision: {
      revisionId: "rev-head-3",
      baseRevisionId: "rev-head-1",
    },
    outputs: [{
      ...headBaseOutputs[0],
      content: "export function stop() { return 1; }",
    }],
  },
  changePlan: { changes: [{ path: "src/a.js" }] },
  baseHead: head,
  baseOutputs: [headBaseOutputs[0]],
});
assert.equal(removesFinalGoalTerm.requiresFullValidation, true);
assert.equal(removesFinalGoalTerm.reason, "goal-term-not-proven:run");

assert.throws(
  () => validator.validate({
    artifact: {
      ...artifact,
      outputs: [indexedOutput, { ...changedOutput, content: "" }],
    },
    changePlan,
  }),
  /Output content is empty/
);

console.log("Artifact incremental validator tests passed");
