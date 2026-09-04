import os from "node:os";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { StimulusFeedQueue } from "../src/services/stimulus-feed-queue.js";

const SAMPLE_COUNT = 12;
const FILES_PER_SAMPLE = 20;
const FAKE_UPLOAD_MS = 3;
const QUEUE_CONCURRENCY = 2;

const files = Array.from({ length: FILES_PER_SAMPLE }, (_, index) => ({
  name: `stimulus-${index + 1}.txt`,
  type: "text/plain",
  size: 128,
}));

await warmUp();
const sequential = await measureSequential();
const queued = await measureQueued();

console.log(JSON.stringify({
  benchmark: "incubator-stimulus-feed-queue",
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  },
  configuration: {
    samples: SAMPLE_COUNT,
    filesPerSample: FILES_PER_SAMPLE,
    fakeUploadMs: FAKE_UPLOAD_MS,
    queueConcurrency: QUEUE_CONCURRENCY,
    durability: "not-applicable-browser-synthetic",
    cache: "not-applicable",
  },
  sequentialReference: sequential,
  boundedQueue: queued,
}, null, 2));

async function warmUp() {
  await runSequential(files.slice(0, 2));
  await runQueued(files.slice(0, 2));
}

async function measureSequential() {
  global.gc?.();
  const rssBefore = process.memoryUsage().rss;
  const cpuBefore = process.cpuUsage();
  const blockedSamples = [];
  const wallStartedAt = performance.now();
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const startedAt = performance.now();
    await runSequential(files);
    blockedSamples.push(performance.now() - startedAt);
  }
  const wallMs = performance.now() - wallStartedAt;
  return summarize({
    inputReleaseSamples: blockedSamples,
    wallMs,
    cpuBefore,
    rssBefore,
  });
}

async function measureQueued() {
  global.gc?.();
  const rssBefore = process.memoryUsage().rss;
  const cpuBefore = process.cpuUsage();
  const releaseSamples = [];
  const wallStartedAt = performance.now();
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const queue = new StimulusFeedQueue({
      concurrency: QUEUE_CONCURRENCY,
      upload: fakeUpload,
    });
    const startedAt = performance.now();
    queue.enqueue(files, { artifactType: "spec" });
    releaseSamples.push(performance.now() - startedAt);
    await queue.whenIdle();
  }
  const wallMs = performance.now() - wallStartedAt;
  return summarize({
    inputReleaseSamples: releaseSamples,
    wallMs,
    cpuBefore,
    rssBefore,
  });
}

async function runSequential(inputs) {
  for (const file of inputs) await fakeUpload(file);
}

async function runQueued(inputs) {
  const queue = new StimulusFeedQueue({ concurrency: QUEUE_CONCURRENCY, upload: fakeUpload });
  queue.enqueue(inputs);
  await queue.whenIdle();
}

async function fakeUpload(file) {
  await new Promise((resolve) => setTimeout(resolve, FAKE_UPLOAD_MS));
  return {
    operationId: `op-${file.name}`,
    type: "stimulus-cultivation",
    status: "accepted",
    context: { sourceName: file.name },
    createdAt: new Date().toISOString(),
  };
}

function summarize({ inputReleaseSamples, wallMs, cpuBefore, rssBefore }) {
  const cpu = process.cpuUsage(cpuBefore);
  const sorted = [...inputReleaseSamples].sort((a, b) => a - b);
  const totalFiles = SAMPLE_COUNT * FILES_PER_SAMPLE;
  return {
    inputReleaseP50Ms: percentile(sorted, 0.5),
    inputReleaseP95Ms: percentile(sorted, 0.95),
    wallMs: round(wallMs),
    throughputFilesPerSecond: round(totalFiles / (wallMs / 1000)),
    cpuMs: round((cpu.user + cpu.system) / 1000),
    rssDeltaBytes: process.memoryUsage().rss - rssBefore,
  };
}

function percentile(sorted, ratio) {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return round(sorted[index]);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
