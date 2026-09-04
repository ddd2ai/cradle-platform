import assert from "node:assert/strict";
import {
  parseProduceDirective,
  resolveArtifactProductionRequest,
} from "../src/production/artifact-production-request.js";
import {
  ARTIFACT_TYPE_CATALOG,
  assertSupportedArtifactType,
} from "../src/production/artifact-type-catalog.js";
import { ArtifactProductionService } from "../src/production/artifact-production-service.js";

assert.deepEqual(
  ARTIFACT_TYPE_CATALOG.map((entry) => entry.id),
  [
    "code",
    "document",
    "spec",
    "research",
    "test",
    "diagram",
    "image",
    "config",
    "sql",
    "prompt",
    "decision",
    "task",
  ],
);

assert.deepEqual(parseProduceDirective("/produce spec Define the API"), {
  type: "spec",
  goal: "Define the API",
});
assert.equal(parseProduceDirective("請產生 API 規格文件"), null);

assert.deepEqual(
  resolveArtifactProductionRequest({
    artifactType: "IMAGE",
    text: "畫一個可直接預覽的商標",
  }),
  {
    decision: "create",
    type: "image",
    goal: "畫一個可直接預覽的商標",
    title: "畫一個可直接預覽的商標",
    mode: "metadata",
    reason: "Explicit image production request",
  },
);

assert.equal(
  resolveArtifactProductionRequest({ text: "請產生 API 規格文件" }).decision,
  "create",
  "every Stimulus must produce a default Artifact",
);
assert.equal(
  resolveArtifactProductionRequest({ text: "請產生 API 規格文件" }).type,
  "document",
  "automatic production uses the neutral document type",
);
assert.equal(
  resolveArtifactProductionRequest({ text: "/produce document 日本語の説明を書く" }).type,
  "document",
  "the explicit type ID must work independently of Goal language",
);

assert.throws(
  () => assertSupportedArtifactType("video"),
  (error) => error.code === "UNSUPPORTED_ARTIFACT_TYPE" && error.supportedTypes.includes("image"),
);

const productionService = new ArtifactProductionService({
  cell: {
    id: "cell-a",
    provider: "test",
    model: "test-model",
    askWithTimeout: async () => "{}",
    formatTimestamp: () => "20260904-000000",
  },
  productionsDir: "/tmp/cradle-artifact-request-test",
});
const authoritativeType = productionService.createArtifactFromParsed({
  parsed: {
    type: "video",
    title: "Model tried to change type",
    outputs: [],
  },
  type: "spec",
  title: "API spec",
  goal: "Define the API",
});
assert.equal(authoritativeType.type, "spec", "model output must not override the selected Artifact type");

let observedProductionTimeout = null;
const boundedService = new ArtifactProductionService({
  cell: {
    id: "cell-b",
    provider: "test",
    model: "test-model",
    readEnvironment: async () => "test environment",
    askWithTimeout: async (_prompt, timeoutMs) => {
      observedProductionTimeout = timeoutMs;
      return JSON.stringify({
        type: "spec",
        title: "API specification",
        outputs: [{
          kind: "file",
          path: "api.md",
          language: "markdown",
          content: "# API\n\nDefined behavior.",
        }],
      });
    },
    formatTimestamp: () => "20260904-000001",
    appendHistory: async () => {},
    appendThought: async () => {},
    mature: async () => {},
  },
  productionsDir: "/tmp/cradle-artifact-bounded-test",
});
boundedService.store = {
  saveArtifact: async () => ({ dir: "/tmp/cradle-artifact-bounded-test", revisionId: "rev-1" }),
};
await boundedService.produce({
  type: "spec",
  title: "API specification",
  goal: "Define API behavior",
});
assert.equal(observedProductionTimeout > 0 && observedProductionTimeout <= 60_000, true);

console.log("Artifact production request tests passed");
