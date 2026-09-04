#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { StimulusCultivationService } from "../src/application/stimulus-cultivation-service.js";

const samples = positiveInteger(process.env.CRADLE_BENCH_STIMULUS_SAMPLES, 40);
const warmups = positiveInteger(process.env.CRADLE_BENCH_STIMULUS_WARMUPS, 5);
const providerLatencyMs = positiveInteger(process.env.CRADLE_BENCH_STIMULUS_PROVIDER_MS, 10);
let sequence = 0;
let productionCalls = 0;
let metabolismCalls = 0;

const cell = benchmarkCell();
const service = new StimulusCultivationService({
  engine: {
    listCells: () => [cell],
    requireCell: () => cell,
  },
});

for (let index = 0; index < warmups; index += 1) {
  await runSample();
}
productionCalls = 0;
metabolismCalls = 0;
const rssBefore = process.memoryUsage().rss;
const cpuBefore = process.cpuUsage();
const durations = [];
const wallStarted = performance.now();
for (let index = 0; index < samples; index += 1) {
  const started = performance.now();
  await runSample();
  durations.push(performance.now() - started);
}
const wallMs = performance.now() - wallStarted;
const cpu = process.cpuUsage(cpuBefore);

console.log(JSON.stringify({
  benchmark: "explicit-stimulus-production",
  status: "current-state only",
  samples,
  warmups,
  providerLatencyMs,
  latencyMs: {
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
  },
  wallMs: round(wallMs),
  throughputPerSecond: round(samples / (wallMs / 1_000)),
  productionCalls,
  metabolismCalls,
  llmCallsPerArtifact: productionCalls / samples,
  cpuMs: round((cpu.user + cpu.system) / 1_000),
  rssDeltaBytes: process.memoryUsage().rss - rssBefore,
  durability: "fake-store",
  cache: "not-applicable",
}, null, 2));

async function runSample() {
  sequence += 1;
  const result = await service.cultivate({
    source: {
      sourceId: `source-${sequence}`,
      stimulusId: `source-stimulus-${sequence}`,
      originalName: `goal-${sequence}.txt`,
      mediaType: "text/plain",
      byteLength: 32,
      sha256: `hash-${sequence}`,
    },
    extraction: {
      status: "extracted",
      method: "benchmark-text-v1",
      text: "Define a payment API with idempotency rules",
      evidence: { outcome: "sufficient", reason: "benchmark input" },
    },
    artifactType: "spec",
    explicitCellId: cell.id,
    operationId: `op-${sequence}`,
  });
  if (result.cells[0]?.artifactEvolution?.decision !== "created") {
    throw new Error("benchmark production did not create an Artifact");
  }
}

function benchmarkCell() {
  return {
    id: "payments",
    name: "Payments",
    artifactStore: { listArtifactSummaries: async () => ({ artifacts: [] }) },
    getProfile: async () => ({ responsibilities: ["payment API"] }),
    readLivingContext: async () => ({ purpose: "Payment API", responsibilities: ["payments"] }),
    writeStimulus: async (input) => ({
      category: input.category,
      file: `stimulus-${sequence}.json`,
      path: `/benchmark/stimulus-${sequence}.json`,
      envelope: {
        ...input,
        stimulusId: `stimulus-${sequence}`,
        createdAt: "2026-09-04T00:00:00.000Z",
      },
    }),
    updateCultivationState: async (patch) => patch,
    appendKnowledge: async () => {},
    archiveStimuli: async () => {},
    readTasks: async () => [],
    metabolismService: {
      metabolize: async () => {
        metabolismCalls += 1;
        return { consumed: 1 };
      },
    },
    produceArtifact: async (input) => {
      productionCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, providerLatencyMs));
      return {
        artifact: {
          id: `artifact-${sequence}`,
          type: input.type,
          outputs: [{ path: "payment-api.md", language: "markdown" }],
        },
        saved: { revisionId: `rev-${sequence}` },
      };
    },
    lifecycleEventStore: { appendLifecycleEvent: async () => {} },
  };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value) {
  return Number(Number(value).toFixed(3));
}
