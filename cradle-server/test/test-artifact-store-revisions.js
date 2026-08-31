import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArtifactStore } from "../src/production/artifact-store.js";
import {
  applyArtifactChangePlan,
  createArtifactChangePlan,
} from "../src/production/artifact-change-plan.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-artifact-revisions-"));
const store = new ArtifactStore({ productionsDir: root });
const artifact = {
  id: "artifact-revisioned",
  type: "generic",
  title: "Revisioned artifact",
  goal: "Keep revisions",
  outputs: [
    { kind: "file", path: "a.txt", language: "text", content: "alpha" },
    { kind: "file", path: "b.txt", language: "text", content: "beta" },
  ],
};

const initialSave = await store.saveArtifact(artifact);
const initial = await store.readArtifact(artifact.id);
assert.equal(initial.outputs[0].content, "alpha");
assert.equal(initial.revision.revisionId, initialSave.revisionId);

const rawManifest = JSON.parse(await fs.readFile(
  path.join(root, artifact.id, "artifact.json"),
  "utf8"
));
assert.equal("content" in rawManifest.outputs[0], false);
assert.equal(typeof rawManifest.outputs[0].contentHash, "string");

await fs.rename(
  path.join(root, artifact.id, "blobs"),
  path.join(root, artifact.id, "blobs-hidden")
);
const summariesWithoutBlobReads = await store.listArtifactSummaries();
assert.equal(summariesWithoutBlobReads.artifacts[0].artifactId, artifact.id);
assert.deepEqual(summariesWithoutBlobReads.artifacts[0].outputPaths, ["a.txt", "b.txt"]);
await fs.rename(
  path.join(root, artifact.id, "blobs-hidden"),
  path.join(root, artifact.id, "blobs")
);

const plan = createArtifactChangePlan({
  artifact: initial,
  allowedPaths: ["a.txt"],
  proposal: {
    changes: [{
      path: "a.txt",
      replacements: [{ before: "alpha", after: "alpha-2" }],
    }],
  },
  revisionIdFactory: () => "rev-incremental",
});
const changed = applyArtifactChangePlan({ artifact: initial, changePlan: plan });
await store.saveArtifactRevision(changed);

const immutableRevisionFile = path.join(
  root,
  artifact.id,
  "revisions",
  `${changed.revision.revisionId}.json`
);
const immutableRevisionBefore = await fs.readFile(immutableRevisionFile, "utf8");
await store.saveArtifact({
  ...changed,
  notes: ["current metadata changed without creating a content revision"],
});
assert.equal(await fs.readFile(immutableRevisionFile, "utf8"), immutableRevisionBefore);
await assert.rejects(
  () => store.saveArtifact({
    ...changed,
    outputs: changed.outputs.map((output) => output.path === "a.txt"
      ? { ...output, content: "mutated-without-new-revision" }
      : output),
  }),
  /revision content is immutable/
);

assert.equal((await store.readArtifact(artifact.id)).outputs[0].content, "alpha-2");
assert.equal(
  (await store.readArtifactRevision(artifact.id, initialSave.revisionId)).outputs[0].content,
  "alpha"
);

const restored = await store.restoreArtifactRevision(artifact.id, initialSave.revisionId);
assert.equal(restored.outputs[0].content, "alpha");
assert.equal(restored.revision.mode, "rollback");

await fs.rm(root, { recursive: true, force: true });
console.log("Artifact store revision tests passed");
