import assert from "node:assert/strict";
import { StimulusCultivationService } from "../src/application/stimulus-cultivation-service.js";

function createCell(id = "orders") {
  const states = [];
  const lifecycleEvents = [];
  let tasks = [];
  return {
    id,
    name: id,
    states,
    lifecycleEvents,
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
    writeStimulus: async (input) => ({
      envelope: {
        ...input,
        schemaVersion: 1,
        stimulusId: "stimulus-1",
        createdAt: "2026-09-02T12:00:00.000Z",
      },
    }),
    appendKnowledge: async () => {},
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
assert.equal(cell.states.at(-1).state, "stable");
assert.equal(cell.lifecycleEvents[0].sourceId, "source-1");
assert.equal(cell.lifecycleEvents[0].sourceStimulusId, "source-stimulus-1");
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
    "metabolism.started",
    "metabolism.completed",
    "cell.stable",
  ],
);

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
assert.equal(retryMetabolismCalls, 1);
assert.equal(retryActivities.includes("stimulus.retrying"), true);
assert.equal(retryActivities.includes("stimulus.persisted"), false);

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
assert.equal(deferredActivities.includes("task.queued"), true);
assert.equal(deferredUpdates.some((patch) => patch.currentStage === "planning"), true);

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
assert.equal(maxActiveMetabolisms, 2, "different Cells should cultivate concurrently");
const concurrentProgress = concurrentUpdates
  .map((patch) => patch.progress)
  .filter((progress) => Number.isFinite(progress));
assert.deepEqual(
  concurrentProgress,
  [...concurrentProgress].sort((left, right) => left - right),
  "aggregate operation progress must not move backwards",
);

console.log("Stimulus cultivation service tests passed");
