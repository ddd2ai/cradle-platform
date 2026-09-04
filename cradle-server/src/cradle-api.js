#!/usr/bin/env node

import { CradleEngine } from "./cradle-engine.js";
import {
  getAiDefaultModel,
  getAiDefaultProvider,
  getAiTimeoutSeconds,
  getActivationConcurrency,
  getLlmConcurrency,
  getHeartbeatMode,
} from "./cradle-config.js";
import { createApiHandler } from "./api/api-handler.js";
import { createHttpServer } from "./api/http-server.js";
import { installConsoleLogBuffer, LogBuffer } from "./application/log-buffer.js";
import { RuntimeEventBus } from "./application/runtime-event-bus.js";
import { RuntimeEventAggregator } from "./application/runtime-event-aggregator.js";
import { SseRuntimeEventTransport } from "./application/runtime/sse-runtime-event-transport.js";
import { WebSocketRuntimeEventTransport } from "./application/runtime/websocket-runtime-event-transport.js";
import { attachRuntimeWebSocketEndpoint } from "./api/runtime-websocket-endpoint.js";
import path from "node:path";
import { SqliteOperationStore } from "./persistence/sqlite-operation-store.js";

const DEFAULT_PORT = 8787;
const BUILT_IN_DEFAULT_PROVIDER = "codex";

const DEFAULT_MODELS = Object.freeze({
  ollama: "devstral-small-2:24b",
  copilot: "gpt-5-mini",
  gemini: "auto",
  codex: "auto",
});

const provider =
  process.env.PROVIDER ??
  getAiDefaultProvider() ??
  BUILT_IN_DEFAULT_PROVIDER;

const model =
  process.env.MODEL ??
  getAiDefaultModel() ??
  DEFAULT_MODELS[provider];

if (!model) {
  throw new Error(`No default model configured for provider: ${provider}`);
}

const engine = new CradleEngine({
  provider,
  model,
  timeoutSeconds: getAiTimeoutSeconds(),
  heartbeatMode: getHeartbeatMode() ?? "manual",
  activationConcurrency: readActivationConcurrency(),
  llmConcurrency: readLlmConcurrency(),
});

function readActivationConcurrency() {
  const configured = process.env.CRADLE_ACTIVATION_CONCURRENCY;
  if (configured === undefined) return getActivationConcurrency();

  const concurrency = Number(configured);
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("CRADLE_ACTIVATION_CONCURRENCY must be a positive integer");
  }
  return concurrency;
}

function readLlmConcurrency() {
  const configured = process.env.CRADLE_LLM_CONCURRENCY;
  if (configured === undefined) return getLlmConcurrency();

  const concurrency = Number(configured);
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("CRADLE_LLM_CONCURRENCY must be a positive integer");
  }
  return concurrency;
}

const eventBus = new RuntimeEventBus();
const sseRuntimeEventTransport = new SseRuntimeEventTransport({
  eventHistory: () => eventBus.history,
});
const websocketRuntimeEventTransport = new WebSocketRuntimeEventTransport();
const aggregator = new RuntimeEventAggregator({
  eventBus,
  transports: [sseRuntimeEventTransport, websocketRuntimeEventTransport],
});
aggregator.start();
const logBuffer = new LogBuffer({ eventBus: aggregator });
installConsoleLogBuffer({ logBuffer });

await engine.loadCells();

const operationStore = new SqliteOperationStore({
  file: process.env.CRADLE_SQLITE_FILE ?? path.join(engine.projectRoot, ".runtime", "cradle.sqlite"),
  eventBus: aggregator,
});
operationStore.reconcileInterrupted();

const port = Number(process.env.PORT || DEFAULT_PORT);
const host = process.env.HOST || "127.0.0.1";
const server = createHttpServer({
  handler: createApiHandler({
    engine,
    eventBus: aggregator,
    logBuffer,
    sseRuntimeEventTransport,
    operationStore,
  }),
});
const websocketEndpoint = attachRuntimeWebSocketEndpoint({
  server,
  transport: websocketRuntimeEventTransport,
});

server.on("close", () => {
  aggregator.stop();
  websocketEndpoint.stop();
});

server.listen(port, host, () => {
  console.log(`Cradle API listening on http://${host}:${port}`);
});
