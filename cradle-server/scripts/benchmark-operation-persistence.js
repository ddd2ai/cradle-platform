import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { InMemoryOperationStore } from "../src/application/operation-store.js";
import { SqliteOperationStore } from "../src/persistence/sqlite-operation-store.js";

const samples = 200;
const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-benchmark-persistence-"));
const sqliteFile = path.join(root, "runtime.sqlite");
const noEvents = { publish() {} };

const measurements = {
  inMemory: measure(() => new InMemoryOperationStore({ eventBus: noEvents, limit: samples + 1 })),
  sqliteWal: measure(() => new SqliteOperationStore({ file: sqliteFile, eventBus: noEvents, limit: samples + 1 })),
};

for (const store of Object.values(measurements)) store.store?.close?.();
await fs.rm(root, { recursive: true, force: true });

console.log(JSON.stringify({
  benchmark: "operation-persistence",
  status: "current-state only",
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: os.cpus()[0]?.model,
  },
  configuration: {
    samples,
    workload: "create + running update + completed update per operation",
    events: "disabled",
    sqlite: "WAL + synchronous=NORMAL",
  },
  result: Object.fromEntries(Object.entries(measurements).map(([name, value]) => [name, {
    p50Ms: percentile(value.samples, 0.5),
    p95Ms: percentile(value.samples, 0.95),
    totalMs: round(value.totalMs),
  }])),
}, null, 2));

function measure(createStore) {
  const store = createStore();
  const samplesTaken = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    const operation = store.create({ type: "stimulus-cultivation", context: { cellIds: [`cell-${index}`] } });
    store.update(operation.operationId, { status: "running", currentStage: "cultivating", progress: 58 });
    store.update(operation.operationId, {
      status: "completed",
      currentStage: "stable",
      progress: 100,
      lifeState: "stable",
      completedAt: new Date().toISOString(),
      result: { cells: [{ cellId: `cell-${index}`, artifactEvolution: { decision: "not-required" } }] },
    });
    samplesTaken.push(performance.now() - started);
  }
  return { store, samples: samplesTaken, totalMs: samplesTaken.reduce((sum, value) => sum + value, 0) };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]);
}

function round(value) {
  return Number(Number(value).toFixed(3));
}
