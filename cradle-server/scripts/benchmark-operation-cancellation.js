import os from "node:os";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { CancelOperationUseCase } from "../src/application/cancel-operation-use-case.js";
import { InMemoryOperationStore } from "../src/application/operation-store.js";
import { OperationRunner } from "../src/application/operation-runner.js";

const WARMUPS = 10;
const SAMPLES = 100;
const terminalWaiters = new Map();
let activeProviderCalls = 0;
let maxActiveProviderCalls = 0;

const store = new InMemoryOperationStore({
  limit: SAMPLES + WARMUPS + 10,
  eventBus: {
    publish(type, payload) {
      if (type !== "operation.updated" || payload.operation?.status !== "cancelled") return;
      terminalWaiters.get(payload.operation.operationId)?.resolve(payload.operation);
    },
  },
});
const runner = new OperationRunner({ operationStore: store });
const cancelUseCase = new CancelOperationUseCase({
  operationStore: store,
  operationRunner: runner,
});

for (let index = 0; index < WARMUPS; index += 1) await runOne();
global.gc?.();
const cpuBefore = process.cpuUsage();
const rssBefore = process.memoryUsage().rss;
const samples = [];
for (let index = 0; index < SAMPLES; index += 1) samples.push(await runOne());
const cpu = process.cpuUsage(cpuBefore);
const sorted = [...samples].sort((left, right) => left - right);

console.log(JSON.stringify({
  benchmark: "stimulus-operation-cancellation",
  status: "current-state only",
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  },
  configuration: {
    warmups: WARMUPS,
    samples: SAMPLES,
    provider: "in-process abort-aware fake",
    network: "none",
    cache: "not-applicable",
    durability: "in-memory operation store",
  },
  result: {
    cancelToTerminalP50Ms: percentile(sorted, 0.5),
    cancelToTerminalP95Ms: percentile(sorted, 0.95),
    maxActiveProviderCalls,
    remainingActiveProviderCalls: activeProviderCalls,
    remainingOperationControllers: runner.controllers.size,
    cpuMs: round((cpu.user + cpu.system) / 1000),
    rssDeltaBytes: process.memoryUsage().rss - rssBefore,
  },
}, null, 2));

async function runOne() {
  const started = deferred();
  const operation = runner.start({
    type: "stimulus-cultivation",
    task: async ({ signal }) => {
      activeProviderCalls += 1;
      maxActiveProviderCalls = Math.max(maxActiveProviderCalls, activeProviderCalls);
      started.resolve();
      try {
        return await new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      } finally {
        activeProviderCalls -= 1;
      }
    },
  });
  await started.promise;
  const terminal = deferred();
  terminalWaiters.set(operation.operationId, terminal);
  const startedAt = performance.now();
  cancelUseCase.execute({ operationId: operation.operationId });
  await terminal.promise;
  const elapsed = performance.now() - startedAt;
  terminalWaiters.delete(operation.operationId);
  return elapsed;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function percentile(sorted, ratio) {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return round(sorted[index]);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
