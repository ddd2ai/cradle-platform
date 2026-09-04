#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { LlmCallScheduler } from "../src/ai/llm-call-scheduler.js";
import { RuntimeMetrics } from "../src/application/runtime-metrics.js";
import { CradleCell } from "../src/cradle-cell.js";
import { CellThinkingService } from "../src/cell/cell-thinking-service.js";
import { CellTaskProcessingService } from "../src/cell/cell-task-processing-service.js";

const SAMPLE_COUNT = 12;
const HEALTHY_CONCURRENCY = 3;

const unbounded = await runScenario({ bounded: false });
const bounded = await runScenario({ bounded: true });
const cancellation = await runCancellationScenario();
const communication = await runCommunicationScenario();

console.log(JSON.stringify({
  benchmark: "llm-scheduling-v1",
  workload: {
    requests: SAMPLE_COUNT,
    healthyProviderConcurrency: HEALTHY_CONCURRENCY,
    baseLatencyMs: 20,
    overloadPenaltyMsPerRequest: 25,
  },
  unbounded,
  bounded,
  cancellation,
  communication,
  correctness: {
    allResponsesReturned: unbounded.completed === SAMPLE_COUNT && bounded.completed === SAMPLE_COUNT,
    concurrencyBoundHeld: bounded.maxProviderConcurrency <= HEALTHY_CONCURRENCY,
    timeoutReleasedProvider: cancellation.providerRunningAfterTimeout === 0,
    timeoutReleasedScheduler: cancellation.schedulerRunningAfterTimeout === 0,
  },
}, null, 2));

async function runScenario({ bounded }) {
  const metrics = new RuntimeMetrics();
  const scheduler = bounded
    ? new LlmCallScheduler({ concurrency: HEALTHY_CONCURRENCY, metrics })
    : null;
  let providerRunning = 0;
  let maxProviderConcurrency = 0;
  const provider = {
    async ask() {
      providerRunning += 1;
      maxProviderConcurrency = Math.max(maxProviderConcurrency, providerRunning);
      const delay = 20 + Math.max(0, providerRunning - HEALTHY_CONCURRENCY) * 25;
      await new Promise((resolve) => setTimeout(resolve, delay));
      providerRunning -= 1;
      return { answer: "ok" };
    },
  };
  const cells = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const cell = new CradleCell({
      id: `benchmark-${index}`,
      llmCallScheduler: scheduler,
      runtimeMetrics: metrics,
    });
    cell.assistant = provider;
    return cell;
  });

  const startedAt = performance.now();
  const samples = await Promise.all(cells.map(async (cell) => {
    const sampleStartedAt = performance.now();
    await cell.askWithTimeout("benchmark", 2_000);
    return performance.now() - sampleStartedAt;
  }));
  const wallMs = performance.now() - startedAt;

  return {
    mode: bounded ? "bounded-current" : "unbounded-reference",
    completed: samples.length,
    wallMs: round(wallMs),
    p50Ms: round(percentile(samples, 0.5)),
    p95Ms: round(percentile(samples, 0.95)),
    throughputPerSecond: round(samples.length / (wallMs / 1_000)),
    maxProviderConcurrency,
    queueWait: bounded
      ? distributionByPrefix(metrics.snapshot(), "llm_queue_wait_ms")
      : null,
  };
}

async function runCancellationScenario() {
  const scheduler = new LlmCallScheduler({ concurrency: 1 });
  const cell = new CradleCell({ id: "timeout", llmCallScheduler: scheduler });
  let providerRunning = 0;
  cell.assistant = {
    async ask(_input, { signal }) {
      providerRunning += 1;
      const pendingRequest = setInterval(() => {}, 1_000);
      return await new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          clearInterval(pendingRequest);
          providerRunning -= 1;
          reject(signal.reason);
        }, { once: true });
      });
    },
  };
  const startedAt = performance.now();
  await cell.askWithTimeout("hang", 20).catch(() => {});
  await Promise.resolve();
  return {
    deadlineMs: 20,
    returnedMs: round(performance.now() - startedAt),
    providerRunningAfterTimeout: providerRunning,
    schedulerRunningAfterTimeout: scheduler.running,
  };
}

async function runCommunicationScenario() {
  const modelLatencyMs = 20;
  let llmCalls = 0;
  const tasks = [];
  const cell = {
    id: "receiver",
    name: "Receiver Cell",
    async askWithTimeout() {
      llmCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, modelLatencyMs));
      return { answer: "Task completed" };
    },
    async addTask(task) {
      const stored = { id: `task-${tasks.length + 1}`, status: "pending", ...task };
      tasks.push(stored);
      return stored;
    },
    async appendKnowledge() {},
    async writeWorkspaceFile() {},
    async appendHistory() {},
    async appendThought() {},
    async mature() {},
    formatTimestamp: () => "benchmark",
  };
  const startedAt = performance.now();
  const digestion = await new CellThinkingService({ cell }).processInbox([{
    id: "delegation-1",
    type: "delegation",
    from: "sender",
    content: "Verify the payment retry policy",
    createdAt: "2026-09-04T08:00:00.000Z",
  }]);
  await new CellTaskProcessingService({ cell }).processTask(tasks[0]);
  const currentWallMs = performance.now() - startedAt;

  const referenceStartedAt = performance.now();
  await cell.askWithTimeout("legacy inbox summary");
  await cell.askWithTimeout("legacy generated task");
  const referenceWallMs = performance.now() - referenceStartedAt;

  return {
    current: {
      wallMs: round(currentWallMs),
      llmCalls: digestion.llmCalls + 1,
      tasksCreated: digestion.tasksCreated,
    },
    previousReference: {
      wallMs: round(referenceWallMs),
      llmCalls: 2,
      tasksCreated: 1,
    },
    modelLatencyMs,
  };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function distributionByPrefix(snapshot, prefix) {
  const distributions = Object.entries(snapshot.distributions)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value);
  const samples = distributions.flatMap((value) => [value.min, value.p50, value.p95, value.max]);
  return {
    samples: distributions.reduce((sum, value) => sum + value.count, 0),
    p50Ms: round(percentile(samples, 0.5)),
    p95Ms: round(percentile(samples, 0.95)),
  };
}

function round(value) {
  return Number(value.toFixed(1));
}
