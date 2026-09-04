import assert from "node:assert/strict";
import { IngestFileStimulusUseCase } from "../src/application/ingest-file-stimulus-use-case.js";
import { InMemoryOperationStore } from "../src/application/operation-store.js";
import { OperationRunner } from "../src/application/operation-runner.js";

const store = new InMemoryOperationStore();
const source = {
  sourceId: "source-1",
  originalName: "brief.txt",
  mediaType: "text/plain",
  byteLength: 5,
  sha256: "hash",
};
let recorded = null;
let recordedStimulus = null;
let cultivationInput = null;
const activities = [];
const useCase = new IngestFileStimulusUseCase({
  engine: { getCell: (id) => id === "cell-a" ? { id } : null },
  sourceStore: {
    accept: async () => source,
    readBytes: async () => Buffer.from("brief"),
    recordExtraction: async (_id, extraction) => { recorded = extraction; },
    recordStimulus: async (_id, stimulus) => { recordedStimulus = stimulus; },
  },
  extractorRegistry: {
    extract: async () => ({ status: "extracted", text: "brief", evidence: { outcome: "sufficient" } }),
  },
  cultivationService: {
    cultivate: async (input) => {
      cultivationInput = input;
      return { lifeState: "stable", currentStage: "stable" };
    },
  },
  operationRunner: new OperationRunner({ operationStore: store }),
  activityLogger: {
    info: (scope, action, fields) => activities.push({ level: "info", scope, action, fields }),
    error: (scope, action, fields) => activities.push({ level: "error", scope, action, fields }),
  },
});

const accepted = await useCase.execute({
  fileName: "brief.txt",
  mediaType: "text/plain",
  bytes: Buffer.from("brief"),
  cellId: "cell-a",
  artifactType: "SPEC",
});
assert.equal(accepted.status, "accepted");
assert.equal(accepted.lifeState, "growing");
assert.equal(accepted.source.stimulusId, recordedStimulus.stimulusId);
assert.equal(recordedStimulus.type, "document.accepted");
assert.equal(recordedStimulus.facts.artifactType, "spec");
await new Promise((resolve) => setTimeout(resolve, 0));
const completed = store.get(accepted.operationId);
assert.equal(completed.status, "completed");
assert.equal(completed.lifeState, "stable");
assert.equal(completed.currentStage, "stable");
assert.equal(recorded.text, "brief");
assert.equal(cultivationInput.artifactType, "spec");
assert.deepEqual(
  activities.map((activity) => activity.action),
  ["source.accepted", "operation.accepted", "extraction.started", "extraction.completed"],
);

await assert.rejects(
  () => useCase.execute({ fileName: "x.txt", bytes: Buffer.from("x"), cellId: "missing" }),
  (error) => error.code === "CELL_NOT_FOUND",
);

await assert.rejects(
  () => useCase.execute({ fileName: "x.txt", bytes: Buffer.from("x"), artifactType: "video" }),
  (error) => error.code === "UNSUPPORTED_ARTIFACT_TYPE" && error.status === 400,
);

console.log("Ingest file stimulus use case tests passed");
