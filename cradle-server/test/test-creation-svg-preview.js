import assert from "node:assert/strict";
import { GetCreationPreviewUseCase } from "../src/application/get-creation-preview-use-case.js";
import { ListCreationsUseCase } from "../src/application/list-creations-use-case.js";

const artifact = {
  id: "artifact-logo",
  type: "image",
  title: "Cradle Logo",
  status: "draft",
  goal: "Create a green logo",
  context: { cellId: "cell-design" },
  outputs: [{
    kind: "file",
    path: "cradle-logo.svg",
    language: "svg",
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#60d394"/></svg>',
  }],
};
const cell = {
  id: "cell-design",
  artifactStore: {
    listArtifactSummaries: async () => ({ artifacts: [{ artifactId: artifact.id }] }),
    readArtifact: async () => artifact,
  },
  hasWorkspacePath: async () => false,
};
const engine = { listCells: () => [cell] };

const creations = await new ListCreationsUseCase({ engine }).execute();
assert.equal(creations.items[0].previewImageUrl, "/api/v1/creations/artifact-logo/preview");

const preview = await new GetCreationPreviewUseCase({ engine }).execute({ artifactId: artifact.id });
assert.equal(preview.status, 200);
assert.equal(preview.headers["content-type"], "image/svg+xml; charset=utf-8");
assert.equal(preview.headers["x-content-type-options"], "nosniff");
assert.match(preview.body.toString("utf8"), /^<svg/);

console.log("Creation SVG preview tests passed");
