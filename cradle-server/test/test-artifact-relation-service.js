import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArtifactRelationService } from "../src/production/artifact-relation-service.js";
import { ArtifactStore } from "../src/production/artifact-store.js";

const rootDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-artifact-relation-")
);
const parentStore = new ArtifactStore({
  productionsDir: path.join(rootDir, "parent"),
});
const childStore = new ArtifactStore({
  productionsDir: path.join(rootDir, "child"),
});

await parentStore.saveArtifact({
  id: "artifact-parent",
  title: "Parent product",
  outputs: [],
});
await childStore.saveArtifact({
  id: "artifact-child",
  title: "Child product",
  outputs: [],
});

const service = new ArtifactRelationService();
const relation = await service.linkDivisionProducts({
  parentCell: { id: "parent-cell", artifactStore: parentStore },
  childCell: { id: "child-cell", artifactStore: childStore },
  parentProduct: { artifactId: "artifact-parent" },
  childProduct: { artifactId: "artifact-child" },
  divisionPlan: {
    sharedContracts: [{
      name: "Child API",
      ownerCellId: "child-cell",
      consumerCellIds: ["parent-cell"],
      inputs: ["Request"],
      outputs: ["Response"],
    }],
  },
});

assert.equal(relation.type, "api-invocation");
assert.equal(relation.sourceProduct.artifactId, "artifact-parent");
assert.equal(relation.targetProduct.artifactId, "artifact-child");
assert.deepEqual(relation.apiInvocations, [{
  contractName: "Child API",
  sourceProduct: {
    cellId: "parent-cell",
    artifactId: "artifact-parent",
  },
  targetProduct: {
    cellId: "child-cell",
    artifactId: "artifact-child",
  },
  inputs: ["Request"],
  outputs: ["Response"],
}]);

const persistedParent = await parentStore.readArtifact("artifact-parent");
const persistedChild = await childStore.readArtifact("artifact-child");
assert.deepEqual(persistedParent.relations, [relation]);
assert.deepEqual(persistedChild.relations, [relation]);

await fs.rm(rootDir, { recursive: true, force: true });

console.log("Artifact relation service tests passed");
