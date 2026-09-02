import { ApiError, mapApiError } from "./api-error.js";
import { AiSettingsStore } from "../ai/ai-settings-store.js";
import { CellOperationGuard } from "../application/cell-operation-guard.js";
import { createApiRoutes } from "./api-routes.js";
import { LogBuffer } from "../application/log-buffer.js";
import { InMemoryOperationStore } from "../application/operation-store.js";
import { RuntimeEventBus } from "../application/runtime-event-bus.js";
import { SseRuntimeEventTransport } from "../application/runtime/sse-runtime-event-transport.js";
import path from "node:path";
import { PROJECT_ROOT } from "../project-root.js";
import { OperationRunner } from "../application/operation-runner.js";
import { SourceDocumentStore } from "../ingestion/source-document-store.js";
import { DocumentExtractorRegistry } from "../ingestion/document-extractor-registry.js";
import { StimulusCultivationService } from "../application/stimulus-cultivation-service.js";
import { IngestFileStimulusUseCase } from "../application/ingest-file-stimulus-use-case.js";
import { ProviderMediaAnalyzer } from "../ingestion/provider-media-analyzer.js";
import {
  RuntimeActivityLogger,
  formatRuntimeActivity,
} from "../application/runtime-activity-logger.js";

// ApplicationEventStream re-export 保留 backward compat (測試與舊 callsite 用)
export { RuntimeEventBus as ApplicationEventStream } from "../application/runtime-event-bus.js";

export function createApiHandler({
  engine,
  aiSettingsStoreFactory = () => new AiSettingsStore(),
  heartbeatModeStoreFactory,
  heartbeatServiceFactory,
  // 接受舊的 eventStream 參數名稱 (backward compat),也接受新的 eventBus
  eventStream = new RuntimeEventBus(),
  eventBus,
  sseRuntimeEventTransport,
  logBuffer,
  activityLogger,
  operationStore,
  operationRunner,
  sourceDocumentStore,
  documentExtractorRegistry,
  mediaAnalyzer,
  stimulusCultivationService,
  ingestFileStimulusUseCase,
  cellOperationGuard = new CellOperationGuard(),
  stabilizationServiceFactory,
  divisionServiceFactory,
  fusionServiceFactory,
  cradleConfigFile,
}) {
  const runtimeEvents = eventBus ?? eventStream;
  const sseTransport = sseRuntimeEventTransport ?? new SseRuntimeEventTransport({
    eventHistory: () => runtimeEvents.history ?? [],
  });

  const resolvedLogBuffer = logBuffer ?? new LogBuffer({ eventBus: runtimeEvents });
  const resolvedActivityLogger = activityLogger ?? new RuntimeActivityLogger({
    write: (activity) => resolvedLogBuffer.append({
      level: activity.level,
      args: [formatRuntimeActivity(activity)],
    }),
  });
  const resolvedOperationStore = operationStore
    ?? new InMemoryOperationStore({ eventBus: runtimeEvents });
  const resolvedOperationRunner = operationRunner
    ?? new OperationRunner({ operationStore: resolvedOperationStore });
  const resolvedSourceStore = sourceDocumentStore ?? new SourceDocumentStore({
    sourcesDir: path.join(engine.projectRoot ?? PROJECT_ROOT, "situation", "sources"),
  });
  const resolvedMediaAnalyzer = mediaAnalyzer ?? new ProviderMediaAnalyzer({
    resolveBinding: () => ({ provider: engine.provider, model: engine.model }),
  });
  const resolvedExtractorRegistry = documentExtractorRegistry ?? new DocumentExtractorRegistry({
    mediaAnalyzer: resolvedMediaAnalyzer,
  });
  const resolvedCultivationService = stimulusCultivationService ?? new StimulusCultivationService({
    engine,
    eventStream: runtimeEvents,
    activityLogger: resolvedActivityLogger,
  });
  const resolvedIngestFileUseCase = ingestFileStimulusUseCase ?? new IngestFileStimulusUseCase({
    engine,
    sourceStore: resolvedSourceStore,
    extractorRegistry: resolvedExtractorRegistry,
    cultivationService: resolvedCultivationService,
    operationRunner: resolvedOperationRunner,
    activityLogger: resolvedActivityLogger,
  });

  const routes = createApiRoutes({
    engine,
    eventStream: runtimeEvents,
    sseRuntimeEventTransport: sseTransport,
    aiSettingsStoreFactory,
    heartbeatModeStoreFactory,
    heartbeatServiceFactory,
    logBuffer: resolvedLogBuffer,
    operationStore: resolvedOperationStore,
    operationRunner: resolvedOperationRunner,
    ingestFileStimulusUseCase: resolvedIngestFileUseCase,
    cellOperationGuard,
    stabilizationServiceFactory,
    divisionServiceFactory,
    fusionServiceFactory,
    cradleConfigFile,
  });

  return async function handleApiRequest(request) {
    try {
      if (typeof engine.syncCellsFromDisk === "function") {
        await engine.syncCellsFromDisk();
      }

      const route = normalizeRoute(request);
      const matchingRoute = routes.find((candidate) => {
        if (candidate.method !== route.method) return false;
        return candidate.match(route) !== null;
      });

      if (!matchingRoute) {
        throw new ApiError({
          status: 404,
          code: "ROUTE_NOT_FOUND",
          message: `Route not found: ${route.method} ${route.pathname}`,
        });
      }

      const params = matchingRoute.match(route);
      const result = await matchingRoute.execute({ request, route, params });
      if (result?.rawResponse === true || result?.streamResponse === true) {
        return result;
      }

      return jsonResponse(resolveSuccessStatus(route, result), result);
    } catch (error) {
      const mapped = mapApiError(error);
      return jsonResponse(mapped.status, mapped.body);
    }
  };
}

function normalizeRoute(request) {
  const url = new URL(request.url, "http://localhost");

  return {
    method: request.method.toUpperCase(),
    pathname: stripTrailingSlash(url.pathname),
    searchParams: url.searchParams,
  };
}

function stripTrailingSlash(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function resolveSuccessStatus(route, result) {
  if (result?.operationId && result.status === "accepted") {
    return 202;
  }

  if (route.method === "POST" && route.pathname === "/api/v1/cells") {
    return 201;
  }

  if (route.method === "POST" && route.pathname === "/api/v1/heartbeat/runs") {
    return 202;
  }

  return 200;
}

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body,
  };
}
