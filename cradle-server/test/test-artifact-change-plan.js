import assert from "node:assert/strict";
import {
  applyArtifactChangePlan,
  createArtifactChangePlan,
} from "../src/production/artifact-change-plan.js";

const artifact = {
  id: "artifact-1",
  revision: { revisionId: "rev-base" },
  outputs: [
    {
      kind: "file",
      path: "src/service.js",
      content: "export function run() {\n  return missing;\n}\n",
    },
    {
      kind: "file",
      path: "README.md",
      content: "# Stable documentation\n",
    },
  ],
  notes: [],
};

const changePlan = createArtifactChangePlan({
  artifact,
  allowedPaths: ["src/service.js"],
  proposal: {
    summary: "Fix undefined value",
    changes: [{
      path: "src/service.js",
      replacements: [{ before: "return missing;", after: "return 'ok';" }],
    }],
  },
  idFactory: () => "change-1",
  revisionIdFactory: () => "rev-next",
  now: () => new Date("2026-01-01T00:00:00.000Z"),
});

const repaired = applyArtifactChangePlan({ artifact, changePlan });
assert.match(repaired.outputs[0].content, /return 'ok'/);
assert.equal(repaired.outputs[1].content, artifact.outputs[1].content);
assert.equal(repaired.revision.revisionId, "rev-next");
assert.deepEqual(repaired.revision.changedPaths, ["src/service.js"]);

assert.throws(
  () => createArtifactChangePlan({
    artifact,
    allowedPaths: ["src/service.js"],
    proposal: {
      changes: [{
        path: "README.md",
        replacements: [{ before: "Stable", after: "Changed" }],
      }],
    },
  }),
  /outside allowed impact/
);

assert.throws(
  () => createArtifactChangePlan({
    artifact: {
      ...artifact,
      outputs: [{
        kind: "file",
        path: "src/service.js",
        content: "same same",
      }],
    },
    allowedPaths: ["src/service.js"],
    proposal: {
      changes: [{
        path: "src/service.js",
        replacements: [{ before: "same", after: "other" }],
      }],
    },
  }),
  /matched 2/
);

assert.throws(
  () => applyArtifactChangePlan({
    artifact: {
      ...artifact,
      outputs: [
        { ...artifact.outputs[0], content: "externally changed" },
        artifact.outputs[1],
      ],
    },
    changePlan,
  }),
  /content hash is stale/
);

console.log("Artifact change plan tests passed");
