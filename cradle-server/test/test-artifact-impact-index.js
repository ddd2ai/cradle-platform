import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildArtifactRepairHead,
  buildArtifactImpactLookupKeys,
  buildArtifactImpactTerms,
  evolveArtifactRepairHead,
} from "../src/production/artifact-impact-index.js";
import { hashContentTerm } from "../src/production/artifact-content-index.js";
import { ArtifactImpactIndexStore } from "../src/production/artifact-impact-index-store.js";

const output = {
  kind: "file",
  path: "src/services/PaymentService.js",
  declaredSymbols: ["PaymentService", "calculateTotal"],
};
const terms = buildArtifactImpactTerms(output);
assert.equal(terms.includes("path:src/services/paymentservice.js"), true);
assert.equal(terms.includes("path:paymentservice.js"), true);
assert.equal(terms.includes("file:paymentservice.js"), true);
assert.equal(terms.includes("stem:paymentservice"), true);
assert.equal(terms.includes("symbol:calculatetotal"), true);

const lookupKeys = buildArtifactImpactLookupKeys({
  task: { title: "修正 PaymentService.js 的 calculateTotal" },
  executionResult: {
    stderr: "src/services/PaymentService.js:12 calculateTotal failed",
  },
});
assert.equal(lookupKeys.includes("path:src/services/paymentservice.js"), true);
assert.equal(lookupKeys.includes("file:paymentservice.js"), true);
assert.equal(lookupKeys.includes("symbol:calculatetotal"), true);

const coverageHead = buildArtifactRepairHead({
  id: "artifact-coverage",
  goal: "包含 run 方法",
  revision: { revisionId: "rev-coverage-1" },
  outputs: [
    { kind: "file", path: "src/a.js", content: "export function run() {}" },
    { kind: "file", path: "src/b.js", content: "const stable = true;" },
  ],
});
assert.equal(coverageHead.goalTermCoverage[hashContentTerm("run")], 1);
const evolvedCoverageHead = evolveArtifactRepairHead({
  baseHead: coverageHead,
  artifact: {
    id: "artifact-coverage",
    goal: "包含 run 方法",
    revision: {
      revisionId: "rev-coverage-2",
      baseRevisionId: "rev-coverage-1",
    },
    outputs: [{ kind: "file", path: "src/a.js", content: "const run = 2;" }],
  },
  previousOutputs: [
    { kind: "file", path: "src/a.js", content: "export function run() {}" },
  ],
  nextOutputs: [{ kind: "file", path: "src/a.js", content: "const run = 2;" }],
});
assert.equal(evolvedCoverageHead.goalTermCoverage[hashContentTerm("run")], 1);
assert.equal(evolvedCoverageHead.outputCount, 2);

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-impact-index-"));
const store = new ArtifactImpactIndexStore({ productionsDir: root });
const initialManifest = {
  revision: { revisionId: "rev-1", mode: "full" },
  outputs: [
    {
      kind: "file",
      path: "src/a.js",
      declaredSymbols: ["AlphaService"],
    },
    {
      kind: "file",
      path: "src/b.js",
      declaredSymbols: ["BetaService"],
    },
  ],
};
assert.deepEqual(
  await store.synchronize({
    artifactId: "artifact-indexed",
    previousManifest: null,
    manifest: initialManifest,
    indexOutputs: initialManifest.outputs,
  }),
  { updated: true, mode: "full" }
);
assert.deepEqual(
  (await store.findCandidatePaths({
    artifactId: "artifact-indexed",
    revisionId: "rev-1",
    lookupKeys: ["symbol:betaservice"],
  })).paths,
  ["src/b.js"]
);
const initialHead = await store.readArtifactHead({
  artifactId: "artifact-indexed",
});
assert.equal(initialHead.available, true);
assert.equal(initialHead.artifact.outputCount, 2);
assert.equal("outputs" in initialHead.artifact, false);
const betaLookup = await store.findCandidatePaths({
  artifactId: "artifact-indexed",
  revisionId: "rev-1",
  lookupKeys: ["symbol:betaservice"],
});
assert.equal(betaLookup.outputs[0].path, "src/b.js");
assert.equal("declaredSymbols" in betaLookup.outputs[0], false);

const nextManifest = {
  revision: {
    revisionId: "rev-2",
    baseRevisionId: "rev-1",
    mode: "incremental",
    changedPaths: ["src/a.js"],
  },
  outputs: [
    {
      kind: "file",
      path: "src/a.js",
      declaredSymbols: ["GammaService"],
    },
    initialManifest.outputs[1],
  ],
};
assert.deepEqual(
  await store.synchronize({
    artifactId: "artifact-indexed",
    previousManifest: initialManifest,
    manifest: nextManifest,
    indexOutputs: nextManifest.outputs,
  }),
  { updated: true, mode: "incremental" }
);
assert.deepEqual(
  (await store.findCandidatePaths({
    artifactId: "artifact-indexed",
    revisionId: "rev-2",
    lookupKeys: ["symbol:alphaservice"],
  })).paths,
  []
);
assert.deepEqual(
  (await store.findCandidatePaths({
    artifactId: "artifact-indexed",
    revisionId: "rev-2",
    lookupKeys: ["symbol:gammaservice", "symbol:betaservice"],
  })).paths.sort(),
  ["src/a.js", "src/b.js"]
);
assert.equal(
  (await store.findCandidatePaths({
    artifactId: "artifact-indexed",
    revisionId: "rev-1",
    lookupKeys: ["symbol:gammaservice"],
  })).available,
  false
);
assert.equal(
  (await store.readArtifactHead({ artifactId: "artifact-indexed" }))
    .artifact.revision.revisionId,
  "rev-2"
);

const broadOutputs = Array.from({ length: 65 }, (_, index) => ({
  kind: "file",
  path: `src/service-${index}.js`,
  declaredSymbols: ["SharedService"],
}));
await store.synchronize({
  artifactId: "artifact-ambiguous",
  previousManifest: null,
  manifest: {
    id: "artifact-ambiguous",
    revision: { revisionId: "rev-broad", mode: "full" },
    outputs: broadOutputs,
  },
  indexOutputs: broadOutputs,
});
const ambiguous = await store.findCandidatePaths({
  artifactId: "artifact-ambiguous",
  revisionId: "rev-broad",
  lookupKeys: ["symbol:sharedservice"],
});
assert.equal(ambiguous.available, true);
assert.equal(ambiguous.ambiguous, true);
assert.deepEqual(ambiguous.paths, []);

await fs.rm(root, { recursive: true, force: true });
console.log("Artifact impact index tests passed");
