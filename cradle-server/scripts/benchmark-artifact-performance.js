#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ArtifactStore } from "../src/production/artifact-store.js";
import {
  applyArtifactChangePlan,
  createArtifactChangePlan,
} from "../src/production/artifact-change-plan.js";
import { evolveArtifactRepairHead } from "../src/production/artifact-impact-index.js";
import { ArtifactMutationCoordinator } from "../src/production/artifact-mutation-coordinator.js";
import { ArtifactMutationFileLease } from "../src/production/artifact-mutation-file-lease.js";

const config = {
  outputCounts: parseIntegerList(
    process.env.CRADLE_BENCH_OUTPUT_COUNTS,
    [10, 100, 1000]
  ),
  cellCounts: parseIntegerList(
    process.env.CRADLE_BENCH_CELL_COUNTS,
    [2, 4, 8, 16]
  ),
  contentBytes: readPositiveInteger("CRADLE_BENCH_CONTENT_BYTES", 4096),
  warmups: readPositiveInteger("CRADLE_BENCH_WARMUPS", 2),
  samples: readPositiveInteger("CRADLE_BENCH_SAMPLES", 7),
  contentionWarmups: readPositiveInteger(
    "CRADLE_BENCH_CONTENTION_WARMUPS",
    1
  ),
  contentionSamples: readPositiveInteger(
    "CRADLE_BENCH_CONTENTION_SAMPLES",
    5
  ),
};

const startedAt = new Date();
const result = {
  schemaVersion: 2,
  startedAt: startedAt.toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    tempDirectory: os.tmpdir(),
  },
  methodology: {
    ...config,
    timer: "performance.now",
    storage: "isolated temporary directories",
    cacheMode: "application-level warm cache after explicit warm-up",
    durability: "Node filesystem completion; no explicit fsync",
    llmIncluded: false,
  },
  outputScaling: [],
  multiCell: {
    independentArtifacts: [],
    sharedArtifactSingleCoordinator: [],
    sharedArtifactCrossCoordinator: [],
  },
};

console.log("Cradle Artifact Performance Benchmark");
console.log(JSON.stringify(result.methodology, null, 2));

for (const outputCount of config.outputCounts) {
  console.log(`\n[output scaling] ${outputCount} outputs`);
  const measurement = await benchmarkOutputScaling(outputCount, config);
  result.outputScaling.push(measurement);
  console.log(formatScalingLine(measurement));
}

for (const cellCount of config.cellCounts) {
  console.log(`\n[multi-cell independent] ${cellCount} cells`);
  const independent = await benchmarkIndependentCells(cellCount, config);
  result.multiCell.independentArtifacts.push(independent);
  console.log(formatIndependentLine(independent));

  console.log(`[multi-cell shared artifact, current runtime] ${cellCount} cells`);
  const singleCoordinator = await benchmarkSharedArtifactContention(
    cellCount,
    config,
    { coordinatorMode: "single" }
  );
  result.multiCell.sharedArtifactSingleCoordinator.push(singleCoordinator);
  console.log(formatSharedLine(singleCoordinator));

  console.log(`[multi-cell shared artifact, cross coordinator] ${cellCount} cells`);
  const crossCoordinator = await benchmarkSharedArtifactContention(
    cellCount,
    config,
    { coordinatorMode: "cross" }
  );
  result.multiCell.sharedArtifactCrossCoordinator.push(crossCoordinator);
  console.log(formatSharedLine(crossCoordinator));
}

result.completedAt = new Date().toISOString();
result.durationMs = Date.now() - startedAt.getTime();
const outputFile = process.env.CRADLE_BENCH_OUTPUT || path.join(
  os.tmpdir(),
  `cradle-artifact-benchmark-${startedAt.toISOString().replaceAll(":", "-")}.json`
);
await fs.writeFile(outputFile, JSON.stringify(result, null, 2), "utf8");

console.log("\nOutput scaling summary (milliseconds)");
console.table(result.outputScaling.map((entry) => ({
  outputs: entry.outputCount,
  fullSaveP50: entry.fullSaveMs.p50,
  fullSaveP95: entry.fullSaveMs.p95,
  deltaP50: entry.deltaPromoteMs.p50,
  deltaP95: entry.deltaPromoteMs.p95,
  selectiveP50: entry.selectiveContextMs.p50,
  manifestP50: entry.manifestReadMs.p50,
  fullReadP50: entry.fullReadMs.p50,
})));

console.log("Multi-Cell summary");
console.table(config.cellCounts.map((cellCount) => {
  const independent = result.multiCell.independentArtifacts.find(
    (entry) => entry.cellCount === cellCount
  );
  const singleCoordinator = result.multiCell.sharedArtifactSingleCoordinator.find(
    (entry) => entry.cellCount === cellCount
  );
  const crossCoordinator = result.multiCell.sharedArtifactCrossCoordinator.find(
    (entry) => entry.cellCount === cellCount
  );
  return {
    cells: cellCount,
    independentWallP50: independent.wallMs.p50,
    independentOpsPerSec: independent.throughputOpsPerSec.p50,
    runtimeSharedWallP50: singleCoordinator.wallMs.p50,
    runtimeSharedOpsPerSec: singleCoordinator.throughputOpsPerSec.p50,
    runtimeAttemptsPerSuccess: singleCoordinator.attemptsPerSuccess.mean,
    crossSharedWallP50: crossCoordinator.wallMs.p50,
    crossSharedOpsPerSec: crossCoordinator.throughputOpsPerSec.p50,
    crossAttemptsPerSuccess: crossCoordinator.attemptsPerSuccess.mean,
    crossLeaseWaitP95: crossCoordinator.leaseWaitMs.p95,
  };
}));

console.log(`Benchmark result: ${outputFile}`);

async function benchmarkOutputScaling(outputCount, benchmarkConfig) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), `cradle-output-${outputCount}-`)
  );
  const store = new ArtifactStore({ productionsDir: root });
  const fullSaveSamples = [];
  try {
    for (
      let iteration = 0;
      iteration < benchmarkConfig.warmups + benchmarkConfig.samples;
      iteration += 1
    ) {
      maybeCollectGarbage();
      const artifactId = `artifact-full-${outputCount}-${iteration}`;
      const artifact = createArtifact({
        artifactId,
        outputCount,
        contentBytes: benchmarkConfig.contentBytes,
        marker: 0,
      });
      const elapsed = await measure(async () => await store.saveArtifact(artifact));
      if (iteration >= benchmarkConfig.warmups) {
        fullSaveSamples.push(elapsed.ms);
      }
      await fs.rm(store.resolveProductionDir(artifactId), {
        recursive: true,
        force: true,
      });
    }

    const artifactId = `artifact-read-${outputCount}`;
    await store.saveArtifact(createArtifact({
      artifactId,
      outputCount,
      contentBytes: benchmarkConfig.contentBytes,
      marker: 0,
    }));

    const deltaSamples = [];
    let marker = 0;
    for (
      let iteration = 0;
      iteration < benchmarkConfig.warmups + benchmarkConfig.samples;
      iteration += 1
    ) {
      const request = await createDeltaRequest({
        store,
        artifactId,
        outputPath: outputPath(0),
        before: `revision:${marker}`,
        after: `revision:${marker + 1}`,
      });
      const elapsed = await measure(
        async () => await store.saveArtifactDelta(request)
      );
      marker += 1;
      if (iteration >= benchmarkConfig.warmups) {
        deltaSamples.push(elapsed.ms);
      }
    }

    const manifestSamples = await sampleOperation({
      warmups: benchmarkConfig.warmups,
      samples: benchmarkConfig.samples,
      operation: async () => await store.readArtifactManifest(artifactId),
    });
    const fullReadSamples = await sampleOperation({
      warmups: benchmarkConfig.warmups,
      samples: benchmarkConfig.samples,
      operation: async () => await store.readArtifact(artifactId),
    });
    const selectiveSamples = await sampleOperation({
      warmups: benchmarkConfig.warmups,
      samples: benchmarkConfig.samples,
      operation: async () => await readSelectiveContext({
        store,
        artifactId,
        outputPath: outputPath(0),
      }),
    });

    return {
      outputCount,
      approximateContentBytes: outputCount * benchmarkConfig.contentBytes,
      fullSaveMs: summarize(fullSaveSamples),
      deltaPromoteMs: summarize(deltaSamples),
      selectiveContextMs: summarize(selectiveSamples),
      manifestReadMs: summarize(manifestSamples),
      fullReadMs: summarize(fullReadSamples),
      raw: {
        fullSaveMs: roundSamples(fullSaveSamples),
        deltaPromoteMs: roundSamples(deltaSamples),
        selectiveContextMs: roundSamples(selectiveSamples),
        manifestReadMs: roundSamples(manifestSamples),
        fullReadMs: roundSamples(fullReadSamples),
      },
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function benchmarkIndependentCells(cellCount, benchmarkConfig) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), `cradle-cells-independent-${cellCount}-`)
  );
  const leaseStats = [];
  try {
    const cells = Array.from({ length: cellCount }, (_, index) => {
      const store = createObservedStore({
        productionsDir: path.join(root, `cell-${index}`, "productions"),
        leaseStats,
      });
      return {
        index,
        store,
        artifactId: `artifact-cell-${index}`,
        marker: 0,
      };
    });
    await Promise.all(cells.map((cell) =>
      cell.store.saveArtifact(createArtifact({
        artifactId: cell.artifactId,
        outputCount: 1,
        contentBytes: benchmarkConfig.contentBytes,
        marker: 0,
      }))
    ));

    const samples = [];
    for (
      let iteration = 0;
      iteration < benchmarkConfig.contentionWarmups +
        benchmarkConfig.contentionSamples;
      iteration += 1
    ) {
      const requests = await Promise.all(cells.map(async (cell) => ({
        cell,
        request: await createDeltaRequest({
          store: cell.store,
          artifactId: cell.artifactId,
          outputPath: outputPath(0),
          before: `revision:${cell.marker}`,
          after: `revision:${cell.marker + 1}`,
        }),
      })));
      const leaseOffset = leaseStats.length;
      const operationDurations = [];
      const wall = await measure(async () => await Promise.all(
        requests.map(async ({ cell, request }) => {
          const operation = await measure(
            async () => await cell.store.saveArtifactDelta(request)
          );
          operationDurations.push(operation.ms);
          cell.marker += 1;
        })
      ));
      if (iteration >= benchmarkConfig.contentionWarmups) {
        const roundLeases = leaseStats.slice(leaseOffset);
        samples.push({
          wallMs: wall.ms,
          operationDurations,
          throughputOpsPerSec: cellCount / (wall.ms / 1000),
          leaseWaitMs: roundLeases.map((entry) => entry.waitMs),
          contentionCount: sum(
            roundLeases.map((entry) => entry.contentionCount)
          ),
        });
      }
    }

    return {
      cellCount,
      wallMs: summarize(samples.map((sample) => sample.wallMs)),
      operationMs: summarize(samples.flatMap(
        (sample) => sample.operationDurations
      )),
      throughputOpsPerSec: summarize(samples.map(
        (sample) => sample.throughputOpsPerSec
      )),
      leaseWaitMs: summarize(samples.flatMap(
        (sample) => sample.leaseWaitMs
      )),
      contentionCount: summarize(samples.map(
        (sample) => sample.contentionCount
      )),
      raw: samples.map(roundObject),
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function benchmarkSharedArtifactContention(
  cellCount,
  benchmarkConfig,
  { coordinatorMode }
) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), `cradle-cells-shared-${cellCount}-`)
  );
  const productionsDir = path.join(root, "productions");
  const artifactId = `artifact-shared-${cellCount}`;
  const leaseStats = [];
  try {
    const setupStore = new ArtifactStore({ productionsDir });
    await setupStore.saveArtifact(createArtifact({
      artifactId,
      outputCount: cellCount,
      contentBytes: benchmarkConfig.contentBytes,
      marker: 0,
    }));
    const sharedCoordinator = new ArtifactMutationCoordinator();
    const cells = Array.from({ length: cellCount }, (_, index) => ({
      index,
      store: createObservedStore({
        productionsDir,
        leaseStats,
        mutationCoordinator: coordinatorMode === "single"
          ? sharedCoordinator
          : new ArtifactMutationCoordinator(),
      }),
    }));
    const samples = [];
    let marker = 0;
    for (
      let iteration = 0;
      iteration < benchmarkConfig.contentionWarmups +
        benchmarkConfig.contentionSamples;
      iteration += 1
    ) {
      const leaseOffset = leaseStats.length;
      const nextMarker = marker + 1;
      const wall = await measure(async () => await Promise.all(
        cells.map(async (cell) => {
          let attempts = 0;
          let staleRejects = 0;
          const operationStarted = performance.now();
          while (true) {
            attempts += 1;
            const request = await createDeltaRequest({
              store: cell.store,
              artifactId,
              outputPath: outputPath(cell.index),
              before: `revision:${marker}`,
              after: `revision:${nextMarker}`,
            });
            try {
              const saved = await cell.store.saveArtifactDelta(request);
              return {
                attempts,
                staleRejects,
                durationMs: performance.now() - operationStarted,
                compacted: saved.compaction?.performed === true,
              };
            } catch (error) {
              if (!String(error?.message).includes("Artifact revision is stale")) {
                throw error;
              }
              staleRejects += 1;
            }
          }
        })
      ));
      marker = nextMarker;
      const workerResults = wall.value;
      if (iteration >= benchmarkConfig.contentionWarmups) {
        const roundLeases = leaseStats.slice(leaseOffset);
        const attempts = sum(workerResults.map((entry) => entry.attempts));
        const staleRejects = sum(
          workerResults.map((entry) => entry.staleRejects)
        );
        samples.push({
          wallMs: wall.ms,
          workerDurationMs: workerResults.map((entry) => entry.durationMs),
          throughputOpsPerSec: cellCount / (wall.ms / 1000),
          attempts,
          staleRejects,
          attemptsPerSuccess: attempts / cellCount,
          leaseWaitMs: roundLeases.map((entry) => entry.waitMs),
          leaseContentionCount: sum(
            roundLeases.map((entry) => entry.contentionCount)
          ),
          compactions: workerResults.filter((entry) => entry.compacted).length,
        });
      }
    }

    const persisted = await setupStore.readArtifact(artifactId);
    const expectedMarker = `revision:${marker}`;
    if (
      persisted.outputs.some(
        (output) => !String(output.content).includes(expectedMarker)
      )
    ) {
      throw new Error("Shared contention benchmark failed persistence verification");
    }

    return {
      cellCount,
      coordinatorMode,
      wallMs: summarize(samples.map((sample) => sample.wallMs)),
      workerDurationMs: summarize(samples.flatMap(
        (sample) => sample.workerDurationMs
      )),
      throughputOpsPerSec: summarize(samples.map(
        (sample) => sample.throughputOpsPerSec
      )),
      attemptsPerSuccess: summarize(samples.map(
        (sample) => sample.attemptsPerSuccess
      )),
      staleRejects: summarize(samples.map((sample) => sample.staleRejects)),
      leaseWaitMs: summarize(samples.flatMap(
        (sample) => sample.leaseWaitMs
      )),
      leaseContentionCount: summarize(samples.map(
        (sample) => sample.leaseContentionCount
      )),
      compactions: sum(samples.map((sample) => sample.compactions)),
      raw: samples.map(roundObject),
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function createObservedStore({
  productionsDir,
  leaseStats,
  mutationCoordinator = new ArtifactMutationCoordinator(),
}) {
  const fileLease = new ArtifactMutationFileLease();
  return new ArtifactStore({
    productionsDir,
    mutationCoordinator,
    mutationLease: {
      async runExclusive(artifactDir, operation) {
        return await fileLease.runExclusive(artifactDir, async (stats) => {
          leaseStats.push(stats);
          return await operation(stats);
        });
      },
    },
  });
}

async function createDeltaRequest({
  store,
  artifactId,
  outputPath: targetPath,
  before,
  after,
}) {
  const repairContext = await store.readArtifactRepairContext(artifactId);
  if (repairContext.mode !== "head") {
    throw new Error(`Benchmark requires repair head: ${artifactId}`);
  }
  const candidates = await store.findArtifactImpactCandidates(
    artifactId,
    [`file:${path.posix.basename(targetPath).toLowerCase()}`],
    { revisionId: repairContext.artifact.revision?.revisionId }
  );
  if (!candidates.available || !candidates.paths.includes(targetPath)) {
    throw new Error(`Benchmark impact candidate unavailable: ${targetPath}`);
  }
  const previousOutputs = await store.readArtifactOutputs(
    artifactId,
    [targetPath],
    { manifest: { outputs: candidates.outputs } }
  );
  const base = { ...repairContext.artifact, outputs: previousOutputs };
  const changePlan = createArtifactChangePlan({
    artifact: base,
    allowedPaths: [targetPath],
    proposal: {
      summary: "Benchmark bounded replacement",
      changes: [{
        path: targetPath,
        replacements: [{ before, after }],
      }],
    },
  });
  const artifact = applyArtifactChangePlan({ artifact: base, changePlan });
  const nextHead = evolveArtifactRepairHead({
    baseHead: repairContext.artifact,
    artifact,
    previousOutputs,
    nextOutputs: artifact.outputs,
  });
  return { artifact, baseHead: repairContext.artifact, nextHead };
}

async function readSelectiveContext({ store, artifactId, outputPath: targetPath }) {
  const repairContext = await store.readArtifactRepairContext(artifactId);
  const candidates = await store.findArtifactImpactCandidates(
    artifactId,
    [`file:${path.posix.basename(targetPath).toLowerCase()}`],
    { revisionId: repairContext.artifact.revision?.revisionId }
  );
  const outputs = await store.readArtifactOutputs(
    artifactId,
    [targetPath],
    { manifest: { outputs: candidates.outputs } }
  );
  return {
    head: repairContext.artifact,
    output: outputs[0],
  };
}

function createArtifact({ artifactId, outputCount, contentBytes, marker }) {
  return {
    id: artifactId,
    type: "generic",
    title: `Benchmark Artifact ${outputCount}`,
    goal: "Measure deterministic artifact persistence performance",
    outputs: Array.from({ length: outputCount }, (_, index) => ({
      kind: "file",
      path: outputPath(index),
      language: "text",
      content: createContent({ index, contentBytes, marker }),
    })),
    notes: [],
    createdAt: "2026-08-31T00:00:00.000Z",
  };
}

function createContent({ index, contentBytes, marker }) {
  const prefix = `output:${index}\nrevision:${marker}\n`;
  return prefix + "x".repeat(Math.max(0, contentBytes - prefix.length));
}

function outputPath(index) {
  return `outputs/output-${String(index).padStart(4, "0")}.txt`;
}

async function sampleOperation({ warmups, samples, operation }) {
  const values = [];
  for (let iteration = 0; iteration < warmups + samples; iteration += 1) {
    maybeCollectGarbage();
    const elapsed = await measure(operation);
    if (iteration >= warmups) values.push(elapsed.ms);
  }
  return values;
}

async function measure(operation) {
  const started = performance.now();
  const value = await operation();
  return { ms: performance.now() - started, value };
}

function summarize(values) {
  if (values.length === 0) {
    return { count: 0, min: 0, p50: 0, p95: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: values.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted.at(-1)),
    mean: round(sum(values) / values.length),
  };
}

function percentile(sorted, quantile) {
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)
  );
  return sorted[index];
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function roundSamples(values) {
  return values.map(round);
}

function roundObject(value) {
  if (Array.isArray(value)) return value.map(roundObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, roundObject(entry)])
    );
  }
  return typeof value === "number" ? round(value) : value;
}

function parseIntegerList(raw, fallback) {
  if (!raw) return fallback;
  const values = raw.split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  if (values.length === 0) {
    throw new Error(`Invalid positive integer list: ${raw}`);
  }
  return [...new Set(values)];
}

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function maybeCollectGarbage() {
  global.gc?.();
}

function formatScalingLine(entry) {
  return [
    `full-save p50/p95=${entry.fullSaveMs.p50}/${entry.fullSaveMs.p95}ms`,
    `delta p50/p95=${entry.deltaPromoteMs.p50}/${entry.deltaPromoteMs.p95}ms`,
    `selective=${entry.selectiveContextMs.p50}ms`,
    `manifest=${entry.manifestReadMs.p50}ms`,
    `full-read=${entry.fullReadMs.p50}ms`,
  ].join(" | ");
}

function formatIndependentLine(entry) {
  return [
    `wall p50/p95=${entry.wallMs.p50}/${entry.wallMs.p95}ms`,
    `throughput p50=${entry.throughputOpsPerSec.p50} ops/s`,
    `lease-wait p95=${entry.leaseWaitMs.p95}ms`,
  ].join(" | ");
}

function formatSharedLine(entry) {
  return [
    `wall p50/p95=${entry.wallMs.p50}/${entry.wallMs.p95}ms`,
    `throughput p50=${entry.throughputOpsPerSec.p50} ops/s`,
    `attempts/success=${entry.attemptsPerSuccess.mean}`,
    `lease-wait p95=${entry.leaseWaitMs.p95}ms`,
  ].join(" | ");
}
