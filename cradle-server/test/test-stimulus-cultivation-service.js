import assert from "node:assert/strict";
import { StimulusCultivationService } from "../src/application/stimulus-cultivation-service.js";

function createCell(id = "orders") {
  const states = [];
  const lifecycleEvents = [];
  const stimulusInputs = [];
  let tasks = [];
  return {
    id,
    name: id,
    states,
    lifecycleEvents,
    stimulusInputs,
    artifactStore: {
      listArtifactSummaries: async () => ({ artifacts: [], errors: [] }),
    },
    getProfile: async () => ({ responsibilities: ["order processing"] }),
    readLivingContext: async () => ({ purpose: "Order processing", responsibilities: ["orders"] }),
    updateCultivationState: async (patch) => {
      const state = { ...(states.at(-1) ?? {}), ...patch };
      states.push(state);
      return state;
    },
    writeStimulus: async (input) => {
      stimulusInputs.push(input);
      return {
      envelope: {
        ...input,
        schemaVersion: 1,
        stimulusId: "stimulus-1",
        createdAt: "2026-09-02T12:00:00.000Z",
      },
      };
    },
    appendKnowledge: async () => {},
    archiveStimuli: async () => {},
    produceArtifact: async (input) => ({
      artifact: {
        id: `artifact-${id}`,
        type: input.type,
        outputs: [{ path: `${id}.md`, language: "markdown" }],
      },
      saved: { revisionId: `revision-${id}` },
    }),
    metabolismService: { metabolize: async () => ({ consumed: 1, processing: "summary-only" }) },
    readTasks: async () => tasks,
    processTask: async () => {},
    completeTask: async (taskId) => {
      tasks = tasks.map((task) => task.id === taskId ? { ...task, status: "completed" } : task);
    },
    lifecycleEventStore: {
      appendLifecycleEvent: async (event) => lifecycleEvents.push(event),
    },
  };
}

const events = [];
const activities = [];
const cell = createCell();
const engine = {
  listCells: () => [cell],
  requireCell: () => cell,
};
const service = new StimulusCultivationService({
  engine,
  eventStream: { publish: (type, payload) => events.push({ type, payload }) },
  artifactEvolutionService: { evaluateAndEvolve: async () => ({ decision: "none" }) },
  activityLogger: {
    info: (scope, action, fields) => activities.push({ level: "info", scope, action, fields }),
    warn: (scope, action, fields) => activities.push({ level: "warn", scope, action, fields }),
    error: (scope, action, fields) => activities.push({ level: "error", scope, action, fields }),
  },
});
const updates = [];
const source = {
  sourceId: "source-1",
  stimulusId: "source-stimulus-1",
  originalName: "orders.txt",
  mediaType: "text/plain",
  byteLength: 20,
  sha256: "abc",
};
const stable = await service.cultivate({
  source,
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Order processing reference",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  explicitCellId: "orders",
  operationId: "op-1",
  update: (patch) => updates.push(patch),
});
assert.equal(stable.lifeState, "stable");
assert.equal(stable.productionIntent.type, "document");
assert.equal(stable.cells[0].artifactEvolution.decision, "created");
assert.equal(cell.states.at(-1).state, "stable");
assert.equal(cell.lifecycleEvents[0].sourceId, "source-1");
assert.equal(cell.lifecycleEvents[0].sourceStimulusId, "source-stimulus-1");
assert.equal(cell.stimulusInputs[0].dedupKey, "file:source-1:orders:document");
assert.equal(events.some((event) => event.type === "cell.cultivation.updated"), true);
assert.equal(updates.some((patch) => patch.currentStage === "stabilizing"), true);
assert.deepEqual(
  activities.map((activity) => activity.action),
  [
    "routing.started",
    "routing.completed",
    "cell.selected",
    "stimulus.persisted",
    "memory.recorded",
    "stimulus.absorbed",
    "artifact.production_started",
    "artifact.production_completed",
    "artifact.evaluation_started",
    "artifact.evaluation_completed",
    "cell.stable",
  ],
);

const productionCell = createCell("payments");
const producedInputs = [];
let directMetabolismCalls = 0;
let archivedStimuli = 0;
productionCell.metabolismService.metabolize = async () => {
  directMetabolismCalls += 1;
  return { consumed: 1 };
};
productionCell.archiveStimuli = async (items) => {
  archivedStimuli += items.length;
};
productionCell.produceArtifact = async (input) => {
  producedInputs.push(input);
  return {
    artifact: {
      id: "artifact-payment-spec",
      type: input.type,
      outputs: [{ path: "payment-api.md", language: "markdown" }],
    },
    saved: { revisionId: "rev-payment-spec" },
  };
};
const productionService = new StimulusCultivationService({
  engine: { listCells: () => [productionCell], requireCell: () => productionCell },
});
const productionResult = await productionService.cultivate({
  source: { ...source, sourceId: "source-spec", sha256: "spec-hash" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "定義付款 API 的輸入、輸出與冪等規則",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  artifactType: "spec",
  explicitCellId: "payments",
  operationId: "op-spec",
});
assert.equal(productionResult.lifeState, "stable");
assert.equal(productionResult.productionIntent.mode, "metadata");
assert.equal(producedInputs.length, 1);
assert.equal(producedInputs[0].type, "spec");
assert.equal(producedInputs[0].goal, "定義付款 API 的輸入、輸出與冪等規則");
assert.equal(producedInputs[0].origin.sourceId, "source-spec");
assert.equal(producedInputs[0].origin.sourceMediaType, "text/plain");
assert.equal(producedInputs[0].origin.sourceSha256, "spec-hash");
assert.equal(directMetabolismCalls, 0, "explicit production must not run a second metabolism LLM call");
assert.equal(archivedStimuli, 1, "the directly produced Stimulus must still be absorbed");
assert.equal(productionResult.cells[0].artifactEvolution.decision, "created");
assert.equal(productionResult.cells[0].artifactEvolution.artifactId, "artifact-payment-spec");

const evolvingCell = createCell("orders-evolving");
let unexpectedCreation = 0;
evolvingCell.artifactStore.listArtifactSummaries = async () => ({
  artifacts: [{ artifactId: "artifact-orders", ownerCellId: "orders-evolving", type: "document", title: "Orders", goal: "orders" }],
  errors: [],
});
evolvingCell.produceArtifact = async () => {
  unexpectedCreation += 1;
  throw new Error("existing Artifact must be evolved, not recreated");
};
const evolutionCalls = [];
const evolvingService = new StimulusCultivationService({
  engine: { listCells: () => [evolvingCell], requireCell: () => evolvingCell },
  artifactEvolutionService: {
    evaluateAndEvolve: async (input) => {
      evolutionCalls.push(input);
      return { decision: "evolved", artifactId: "artifact-orders", revisionId: "rev-orders-2", provenance: { stimulusId: input.stimulus.stimulusId } };
    },
  },
});
const evolved = await evolvingService.cultivate({
  source: { ...source, sourceId: "source-orders-2", sha256: "orders-hash-2" },
  extraction: { status: "extracted", method: "utf8-text-v1", text: "Add return handling to the order flow", evidence: { outcome: "sufficient", reason: "decoded" } },
  explicitCellId: "orders-evolving",
  operationId: "op-orders-2",
});
assert.equal(unexpectedCreation, 0);
assert.equal(evolutionCalls.length, 1);
assert.equal(evolved.cells[0].artifactEvolution.decision, "evolved");
assert.equal(evolved.cells[0].artifactEvolution.revisionId, "rev-orders-2");

const cancelledCell = createCell("payments-cancelled");
cancelledCell.getCultivationState = async () => cancelledCell.states.at(-1);
const productionStarted = createDeferred();
cancelledCell.produceArtifact = async ({ signal }) => {
  productionStarted.resolve();
  return await new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
};
const cancelledService = new StimulusCultivationService({
  engine: { listCells: () => [cancelledCell], requireCell: () => cancelledCell },
});
const cancellationController = new AbortController();
const cancelledCultivation = cancelledService.cultivate({
  source: { ...source, sourceId: "source-cancelled", sha256: "cancelled-hash" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Create a payment specification",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  artifactType: "spec",
  explicitCellId: "payments-cancelled",
  operationId: "op-cancelled",
  signal: cancellationController.signal,
});
await productionStarted.promise;
cancellationController.abort(Object.assign(new Error("cancel cultivation"), {
  code: "OPERATION_CANCELLED",
}));
await assert.rejects(cancelledCultivation, /cancel cultivation/);
assert.equal(cancelledCell.states.at(-1).state, "cancelled");
assert.equal(cancelledCell.states.at(-1).attention, null);
assert.equal(cancelledCell.lifecycleEvents.at(-1).status, "cancelled");
assert.equal(cancelledCell.lifecycleEvents.at(-1).qualityOutcome, null);

const productionCells = [createCell("orders-a"), createCell("orders-b")];
let multiCellProductionCalls = 0;
let secondarySummaryCalls = 0;
for (const candidate of productionCells) {
  candidate.produceArtifact = async (input) => {
    multiCellProductionCalls += 1;
    return {
      artifact: {
        id: `artifact-${candidate.id}`,
        type: input.type,
        outputs: [{ path: "order-flow.mmd", language: "mermaid" }],
      },
      saved: { revisionId: `rev-${candidate.id}` },
    };
  };
  candidate.metabolismService.metabolize = async ({ summaryOnly }) => {
    assert.equal(summaryOnly, true);
    secondarySummaryCalls += 1;
    return { consumed: 1, processing: "summary-only" };
  };
}
const multiCellProduction = await new StimulusCultivationService({
  engine: {
    listCells: () => productionCells,
    requireCell: (cellId) => productionCells.find((candidate) => candidate.id === cellId),
  },
}).cultivate({
  source: { ...source, sourceId: "source-diagram", sha256: "diagram-hash" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Order processing flow between order services",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  artifactType: "diagram",
  operationId: "op-diagram",
});
assert.equal(multiCellProduction.cells.length, 2);
assert.equal(multiCellProductionCalls, 1, "only the primary routed Cell may produce the Artifact");
assert.equal(secondarySummaryCalls, 1, "secondary routed Cells must absorb without duplicate production");

const attentionCell = createCell();
const attentionService = new StimulusCultivationService({
  engine: { listCells: () => [attentionCell], requireCell: () => attentionCell },
  artifactEvolutionService: { evaluateAndEvolve: async () => ({ decision: "none" }) },
});
const attention = await attentionService.cultivate({
  source: { ...source, sourceId: "source-image", originalName: "scan.png", mediaType: "image/png" },
  extraction: {
    status: "metadata-only",
    method: "image-metadata-v1",
    text: "",
    evidence: { outcome: "insufficient_evidence", reason: "OCR unavailable" },
  },
  explicitCellId: "orders",
  operationId: "op-2",
});
assert.equal(attention.lifeState, "needs_attention");
assert.equal(attentionCell.states.at(-1).attention.message, "OCR unavailable");

const validationCell = createCell();
const validationService = new StimulusCultivationService({
  engine: { listCells: () => [validationCell], requireCell: () => validationCell },
  artifactEvolutionService: {
    evaluateAndEvolve: async () => ({
      decision: "needs-attention",
      reason: "validation rejected the proposed replacement",
    }),
  },
});
const validationAttention = await validationService.cultivate({
  source: { ...source, sourceId: "source-risk", sha256: "risk-hash" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Security failure: orders must update app.js immediately",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  explicitCellId: "orders",
  operationId: "op-3",
});
assert.equal(validationAttention.lifeState, "needs_attention");
assert.match(validationCell.states.at(-1).attention.message, /validation rejected/);

const retryCell = createCell();
let retryMetabolismCalls = 0;
retryCell.writeStimulus = async (input) => ({
  duplicate: true,
  duplicateOf: "stimulus-retry",
  envelope: {
    ...input,
    schemaVersion: 1,
    stimulusId: "stimulus-retry",
    createdAt: "2026-09-02T12:00:00.000Z",
  },
});
retryCell.getCultivationState = async () => ({
  state: "needs_attention",
  stimulusId: "stimulus-retry",
});
retryCell.metabolismService.metabolize = async () => {
  retryMetabolismCalls += 1;
  return { consumed: 1, processing: "summary-only" };
};
const retryActivities = [];
const retryService = new StimulusCultivationService({
  engine: { listCells: () => [retryCell], requireCell: () => retryCell },
  artifactEvolutionService: { evaluateAndEvolve: async () => ({ decision: "none" }) },
  activityLogger: {
    info: (_scope, action) => retryActivities.push(action),
    warn: () => {},
    error: () => {},
  },
});
const retried = await retryService.cultivate({
  source: { ...source, sourceId: "source-image-retry", sha256: "image-retry" },
  extraction: {
    status: "extracted",
    method: "provider-media-analysis-v1",
    text: "Visual summary: A green circular logo",
    evidence: { outcome: "sufficient", reason: "visual observation" },
  },
  explicitCellId: "orders",
  operationId: "op-image-retry",
});
assert.equal(retried.lifeState, "stable");
assert.equal(retryMetabolismCalls, 0, "retry must regrow the Artifact instead of summary metabolism");
assert.equal(retryActivities.includes("stimulus.retrying"), true);
assert.equal(retryActivities.includes("stimulus.persisted"), false);

const cancelledRetryCell = createCell("cancelled-retry");
let cancelledRetryProductionCalls = 0;
cancelledRetryCell.writeStimulus = async (input) => ({
  duplicate: true,
  duplicateOf: "stimulus-cancelled-retry",
  envelope: {
    ...input,
    schemaVersion: 1,
    stimulusId: "stimulus-cancelled-retry",
    createdAt: "2026-09-04T12:00:00.000Z",
  },
});
cancelledRetryCell.getCultivationState = async () => ({
  state: "cancelled",
  stimulusId: "stimulus-cancelled-retry",
});
cancelledRetryCell.produceArtifact = async (input) => {
  cancelledRetryProductionCalls += 1;
  return {
    artifact: {
      id: "artifact-after-cancel",
      type: input.type,
      outputs: [{ path: "result.md", language: "markdown" }],
    },
    saved: { revisionId: "rev-after-cancel" },
  };
};
const cancelledRetryService = new StimulusCultivationService({
  engine: {
    listCells: () => [cancelledRetryCell],
    requireCell: () => cancelledRetryCell,
  },
});
const cancelledRetry = await cancelledRetryService.cultivate({
  source: { ...source, sourceId: "source-cancelled-retry", sha256: "cancelled-retry" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Create the specification again",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  artifactType: "spec",
  explicitCellId: "cancelled-retry",
  operationId: "op-cancelled-retry",
});
assert.equal(cancelledRetry.lifeState, "stable");
assert.equal(cancelledRetryProductionCalls, 1, "a cancelled duplicate must remain retryable");
assert.equal(cancelledRetry.cells[0].artifactEvolution.artifactId, "artifact-after-cancel");

const deferredTaskCell = createCell("payments");
let deferredTaskReads = 0;
let deferredTaskProcessingCalls = 0;
deferredTaskCell.readTasks = async () => {
  deferredTaskReads += 1;
  return deferredTaskReads === 1
    ? []
    : [{ id: "task-payment-safety", status: "pending" }];
};
deferredTaskCell.processTask = async () => {
  deferredTaskProcessingCalls += 1;
};
deferredTaskCell.metabolismService.metabolize = async () => ({
  consumed: 1,
  created: 1,
  processing: "reasoning",
});
const deferredActivities = [];
const deferredUpdates = [];
const deferredService = new StimulusCultivationService({
  engine: {
    listCells: () => [deferredTaskCell],
    requireCell: () => deferredTaskCell,
  },
  activityLogger: {
    info: (_scope, action) => deferredActivities.push(action),
    warn: () => {},
    error: () => {},
  },
});
const deferred = await deferredService.cultivate({
  source: { ...source, sourceId: "source-payment", sha256: "payment-hash" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Payment failure must preserve idempotency and transaction evidence",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  explicitCellId: "payments",
  operationId: "op-payment",
  update: (patch) => deferredUpdates.push(patch),
});
assert.equal(deferred.lifeState, "stable");
assert.equal(deferredTaskProcessingCalls, 0, "cultivation must not synchronously execute the queued task");
assert.equal(deferred.cells[0].artifactEvolution.decision, "created");

let activeMetabolisms = 0;
let maxActiveMetabolisms = 0;
const concurrentCells = [createCell("orders-a"), createCell("orders-b")];
for (const concurrentCell of concurrentCells) {
  concurrentCell.metabolismService.metabolize = async () => {
    activeMetabolisms += 1;
    maxActiveMetabolisms = Math.max(maxActiveMetabolisms, activeMetabolisms);
    await new Promise((resolve) => setTimeout(resolve, 20));
    activeMetabolisms -= 1;
    return { consumed: 1, processing: "summary-only" };
  };
}
const concurrentService = new StimulusCultivationService({
  engine: {
    listCells: () => concurrentCells,
    requireCell: (cellId) => concurrentCells.find((candidate) => candidate.id === cellId),
  },
});
const concurrentUpdates = [];
const concurrent = await concurrentService.cultivate({
  source: { ...source, sourceId: "source-concurrent", sha256: "concurrent-hash" },
  extraction: {
    status: "extracted",
    method: "utf8-text-v1",
    text: "Order processing reference",
    evidence: { outcome: "sufficient", reason: "decoded" },
  },
  operationId: "op-concurrent",
  update: (patch) => concurrentUpdates.push(patch),
});
assert.equal(concurrent.cells.length, 2);
assert.equal(maxActiveMetabolisms, 1, "only secondary Cells use metabolism after primary Artifact production");
const concurrentProgress = concurrentUpdates
  .map((patch) => patch.progress)
  .filter((progress) => Number.isFinite(progress));
assert.deepEqual(
  concurrentProgress,
  [...concurrentProgress].sort((left, right) => left - right),
  "aggregate operation progress must not move backwards",
);

console.log("Stimulus cultivation service tests passed");

function createDeferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
