#!/usr/bin/env node

import { CradleEngine } from "./cradle-engine.js";
import {
  getAiDefaultModel,
  getAiDefaultProvider,
  getAiTimeoutSeconds,
  getHeartbeatMode,
} from "./cradle-config.js";
import { createApiHandler } from "./api/api-handler.js";
import { createHttpServer } from "./api/http-server.js";
import { installConsoleLogBuffer, LogBuffer } from "./application/log-buffer.js";
import { RuntimeEventBus } from "./application/runtime-event-bus.js";
import { RuntimeEventAggregator } from "./application/runtime-event-aggregator.js";

const DEFAULT_PORT = 8787;
const BUILT_IN_DEFAULT_PROVIDER = "ollama";

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
});

const eventBus = new RuntimeEventBus();
const aggregator = new RuntimeEventAggregator({ eventBus });
const logBuffer = new LogBuffer({ eventBus: aggregator });
installConsoleLogBuffer({ logBuffer });

await engine.loadCells();

const port = Number(process.env.PORT || DEFAULT_PORT);
const host = process.env.HOST || "127.0.0.1";
const server = createHttpServer({
  handler: createApiHandler({ engine, eventBus: aggregator, logBuffer }),
});

server.listen(port, host, () => {
  console.log(`Cradle API listening on http://${host}:${port}`);
});
