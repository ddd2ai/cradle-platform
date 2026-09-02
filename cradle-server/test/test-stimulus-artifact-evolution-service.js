import assert from "node:assert/strict";
import { StimulusArtifactEvolutionService } from "../src/production/stimulus-artifact-evolution-service.js";

const stimulus = {
  stimulusId: "stimulus-1",
  summary: "Update app.js retry behavior",
  content: "app.js must retry once",
  createdAt: "2026-09-02T00:00:00.000Z",
};
const source = {
  sourceId: "source-1",
  stimulusId: "stim-source-1",
  originalName: "runtime-policy.txt",
  mediaType: "text/plain",
};

const none = await new StimulusArtifactEvolutionService().evaluateAndEvolve({
  cell: createCell({ artifacts: [] }),
  stimulus,
  source,
});
assert.equal(none.decision, "none");

const ambiguous = await new StimulusArtifactEvolutionService().evaluateAndEvolve({
  cell: createCell({ artifacts: [
    { artifactId: "artifact-a", title: "app.js behavior", outputPaths: ["app.js"] },
    { artifactId: "artifact-b", title: "app.js behavior", outputPaths: ["app.js"] },
  ] }),
  stimulus,
  source,
});
assert.equal(ambiguous.decision, "needs-attention");
assert.equal(ambiguous.candidates.length, 2);

let appliedPlan = null;
let evolutionPrompt = null;
const service = new StimulusArtifactEvolutionService({
  now: () => new Date("2026-09-02T01:00:00.000Z"),
  mutationServiceFactory: () => ({
    async apply(plan) {
      appliedPlan = plan;
      return {
        artifact: { revision: { revisionId: plan.revisionId } },
        validation: { valid: true },
      };
    },
  }),
});
const evolved = await service.evaluateAndEvolve({
  cell: createCell({
    artifacts: [{ artifactId: "artifact-app", title: "Application runtime", outputPaths: ["app.js"] }],
    artifact: {
      id: "artifact-app",
      ownerCellId: "cell-a",
      title: "Application runtime",
      goal: "Keep runtime behavior reliable",
      revision: { revisionId: "rev-base" },
      outputs: [{ kind: "file", path: "app.js", content: "const retries = 0;" }],
    },
    answer: JSON.stringify({
      decision: "change",
      summary: "Apply the observed retry policy",
      changes: [{
        path: "app.js",
        replacements: [{ before: "const retries = 0;", after: "const retries = 1;" }],
      }],
    }),
  }),
  stimulus,
  source,
});

assert.equal(evolved.decision, "evolved");
assert.equal(evolved.artifactId, "artifact-app");
assert.deepEqual(evolved.changedPaths, ["app.js"]);
assert.deepEqual(appliedPlan.provenance, {
  mode: "stimulus",
  stimulusId: "stimulus-1",
  sourceId: "source-1",
  sourceStimulusId: "stim-source-1",
  cellId: "cell-a",
  observedAt: "2026-09-02T00:00:00.000Z",
  evaluatedAt: "2026-09-02T01:00:00.000Z",
});
assert.match(evolutionPrompt, /Node 22 production runtime/);

await assert.rejects(
  () => service.evaluateAndEvolve({
    cell: createCell({
      artifacts: [{ artifactId: "artifact-app", title: "Application runtime", outputPaths: ["app.js"] }],
      artifact: {
        id: "artifact-app",
        ownerCellId: "cell-b",
        title: "Application runtime",
        goal: "Keep runtime behavior reliable",
        revision: { revisionId: "rev-base" },
        outputs: [{ kind: "file", path: "app.js", content: "const retries = 0;" }],
      },
    }),
    stimulus,
    source,
  }),
  (error) => error.code === "ARTIFACT_OWNER_VIOLATION",
);

function createCell({ artifacts, artifact = null, answer = "{}" }) {
  return {
    id: "cell-a",
    artifactStore: {
      listArtifactSummaries: async () => ({ artifacts }),
      readArtifact: async () => artifact,
      findArtifactImpactCandidates: async () => ({ available: false, paths: [] }),
    },
    readEnvironment: async () => "Node 22 production runtime",
    askWithTimeout: async (prompt) => {
      evolutionPrompt = prompt;
      return answer;
    },
  };
}

console.log("Stimulus Artifact evolution service tests passed");
