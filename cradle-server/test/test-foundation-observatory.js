import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FoundationDocumentStore } from "../src/foundation/foundation-document-store.js";
import { GetObservatoryUseCase } from "../src/application/get-observatory-use-case.js";
import { createApiHandler } from "../src/api/api-handler.js";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-foundation-"));
const configDir = path.join(tempRoot, "config");
await fs.mkdir(configDir);
for (const fileName of ["VISION.md", "ENVIRONMENT.md", "DNA_DEFINITION.md", "DNA_FACTORS.md"]) {
  await fs.writeFile(path.join(configDir, fileName), `# ${fileName}\n`, "utf8");
}

const store = new FoundationDocumentStore({ configDir });
const documents = await store.list();
assert.deepEqual(documents.map((item) => item.id), [
  "vision",
  "environment",
  "dna-dimensions",
  "dna-factors",
]);

const vision = documents[0];
const savedVision = await store.write("vision", {
  content: "# Product direction",
  expectedRevision: vision.revision,
});
assert.equal(savedVision.content, "# Product direction\n");
assert.notEqual(savedVision.revision, vision.revision);
await assert.rejects(
  store.write("vision", { content: "# Stale", expectedRevision: vision.revision }),
  (error) => error.code === "FOUNDATION_REVISION_CONFLICT",
);
await assert.rejects(
  store.write("unknown", { content: "# Unknown" }),
  (error) => error.code === "FOUNDATION_DOCUMENT_NOT_FOUND",
);

const dnaHistory = [
  { at: "2026-09-01T00:00:00.000Z", reason: "seed", vector: vector(0.2) },
  { at: "2026-09-02T00:00:00.000Z", reason: "cultivation", vector: vector(0.4) },
];
const cell = {
  id: "cell-001",
  name: "cell-001",
  isActive: () => true,
  getProfile: async () => ({ status: "active", generation: 1 }),
  getCultivationState: async () => ({ state: "growing", progress: 62 }),
  getMaturityInfo: async () => ({ percent: 31, sampleSize: 2, dominantTrait: "CREATION" }),
  readDNAVector: async () => vector(0.4),
  readDNAHistory: async () => dnaHistory,
  readLifecycleEvents: async () => [{ at: "2026-09-02T00:00:00.000Z", type: "cultivation" }],
};
const observatory = await new GetObservatoryUseCase({
  engine: { listCells: () => [cell] },
  now: () => new Date("2026-09-02T10:00:00.000Z"),
}).execute();

assert.equal(observatory.observedAt, "2026-09-02T10:00:00.000Z");
assert.equal(observatory.cells[0].cultivation.state, "growing");
assert.equal(observatory.cells[0].dna.maturityTrend[0].outcome, "insufficient_evidence");
assert.equal(observatory.cells[0].dna.maturityTrend[1].outcome, "observed");
assert.equal(observatory.cells[0].lifecycleEvents.length, 1);

const handler = createApiHandler({
  engine: {
    projectRoot: tempRoot,
    provider: "codex",
    model: "auto",
    runtimeMetrics: { snapshot: () => ({}) },
    listCells: () => [cell],
  },
  foundationDocumentStore: store,
});
const foundationResponse = await handler({
  method: "GET",
  url: "/api/v1/foundation",
  headers: {},
});
assert.equal(foundationResponse.status, 200);
assert.equal(foundationResponse.body.documents.length, 4);

const observatoryResponse = await handler({
  method: "GET",
  url: "/api/v1/observatory",
  headers: {},
});
assert.equal(observatoryResponse.status, 200);
assert.equal(observatoryResponse.body.cells[0].cellId, "cell-001");

const updateResponse = await handler({
  method: "PUT",
  url: "/api/v1/foundation/environment",
  headers: { "content-type": "application/json" },
  body: {
    content: "# Updated environment",
    expectedRevision: documents[1].revision,
  },
});
assert.equal(updateResponse.status, 200);
assert.equal(updateResponse.body.document.content, "# Updated environment\n");

const unsafeUpdateResponse = await handler({
  method: "PUT",
  url: "/api/v1/foundation/environment",
  headers: { "content-type": "application/json" },
  body: { content: "# Missing revision" },
});
assert.equal(unsafeUpdateResponse.status, 400);
assert.equal(unsafeUpdateResponse.body.error.code, "FOUNDATION_REVISION_REQUIRED");

await fs.rm(tempRoot, { recursive: true, force: true });
console.log("Foundation and Observatory tests passed");

function vector(value) {
  return {
    PERCEPTION: { strength: value },
    REASONING: { strength: value },
    CREATION: { strength: value },
    VALIDATION: { strength: value },
    REPAIR: { strength: value },
    MEMORY: { strength: value },
    COLLABORATION: { strength: value },
    ADAPTATION: { strength: value },
  };
}
