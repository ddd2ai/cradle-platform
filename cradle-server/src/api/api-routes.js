import { CreateCellUseCase } from "../application/create-cell-use-case.js";
import { DivideCellUseCase } from "../application/divide-cell-use-case.js";
import { ClearLogsUseCase } from "../application/clear-logs-use-case.js";
import { ExportCellArtifactUseCase } from "../application/export-cell-artifact-use-case.js";
import { ExportCellWorkspaceUseCase } from "../application/export-cell-workspace-use-case.js";
import { FeedCellUseCase } from "../application/feed-cell-use-case.js";
import { GetCellArtifactUseCase } from "../application/get-cell-artifact-use-case.js";
import { GetCellAiBindingUseCase } from "../application/get-cell-ai-binding-use-case.js";
import { GetAiSettingsUseCase } from "../application/get-ai-settings-use-case.js";
import { GetCellDnaUseCase } from "../application/get-cell-dna-use-case.js";
import { GetCellDnaHistoryUseCase } from "../application/get-cell-dna-history-use-case.js";
import { GetCellLifecycleDecisionUseCase } from "../application/get-cell-lifecycle-decision-use-case.js";
import { GetCellMaturityUseCase } from "../application/get-cell-maturity-use-case.js";
import { GetCellArtifactStabilityUseCase } from "../application/get-cell-artifact-stability-use-case.js";
import { GetCellUseCase } from "../application/get-cell-use-case.js";
import { GetColonyUseCase } from "../application/get-colony-use-case.js";
import { GetCradleConfigUseCase } from "../application/get-cradle-config-use-case.js";
import { GetFoundationUseCase } from "../application/get-foundation-use-case.js";
import { GetObservatoryUseCase } from "../application/get-observatory-use-case.js";
import { GetCultivationStatusUseCase } from "../application/get-cultivation-status-use-case.js";
import { GetHeartbeatUseCase } from "../application/get-heartbeat-use-case.js";
import { GetHealthUseCase } from "../application/get-health-use-case.js";
import { GetOperationUseCase } from "../application/get-operation-use-case.js";
import { FuseCellsUseCase } from "../application/fuse-cells-use-case.js";
import { GetCreationPreviewUseCase } from "../application/get-creation-preview-use-case.js";
import { HeartbeatModeStore } from "../heartbeat/heartbeat-mode.js";
import { ListCellArtifactsUseCase } from "../application/list-cell-artifacts-use-case.js";
import { ListArtifactTypesUseCase } from "../application/list-artifact-types-use-case.js";
import { ListCellInboxUseCase } from "../application/list-cell-inbox-use-case.js";
import { ListCellLifecycleEventsUseCase } from "../application/list-cell-lifecycle-events-use-case.js";
import { ListCellTasksUseCase } from "../application/list-cell-tasks-use-case.js";
import { ListCellSnapshotsUseCase } from "../application/list-cell-snapshots-use-case.js";
import { ListCellWorkspaceEntriesUseCase } from "../application/list-cell-workspace-entries-use-case.js";
import { ListCellWorkspaceUseCase } from "../application/list-cell-workspace-use-case.js";
import { ListCellsUseCase } from "../application/list-cells-use-case.js";
import { ListCreationsUseCase } from "../application/list-creations-use-case.js";
import { ListLogsUseCase } from "../application/list-logs-use-case.js";
import { ListOperationsUseCase } from "../application/list-operations-use-case.js";
import { ListRuntimeMetricsUseCase } from "../application/list-runtime-metrics-use-case.js";
import { OperationRunner } from "../application/operation-runner.js";
import { ReadCellWorkspaceFileUseCase } from "../application/read-cell-workspace-file-use-case.js";
import { ReadCellWorkspacePreviewUseCase } from "../application/read-cell-workspace-preview-use-case.js";
import { RunHeartbeatUseCase } from "../application/run-heartbeat-use-case.js";
import { SetAllCellsActiveUseCase } from "../application/set-all-cells-active-use-case.js";
import { SetAiSettingsUseCase } from "../application/set-ai-settings-use-case.js";
import { SetCellActiveUseCase } from "../application/set-cell-active-use-case.js";
import { SetCellAiBindingUseCase } from "../application/set-cell-ai-binding-use-case.js";
import { SetHeartbeatModeUseCase } from "../application/set-heartbeat-mode-use-case.js";
import { StabilizeCellUseCase } from "../application/stabilize-cell-use-case.js";
import { UpdateCradleConfigUseCase } from "../application/update-cradle-config-use-case.js";
import { UpdateFoundationDocumentUseCase } from "../application/update-foundation-document-use-case.js";
import { StartOperationUseCase } from "../application/start-operation-use-case.js";

export function createApiRoutes({
  engine,
  eventStream,
  sseRuntimeEventTransport,
  heartbeatModeStoreFactory = () => new HeartbeatModeStore(),
  aiSettingsStoreFactory,
  heartbeatServiceFactory,
  logBuffer,
  operationStore,
  operationRunner = new OperationRunner({ operationStore }),
  cellOperationGuard,
  stabilizationServiceFactory,
  divisionServiceFactory,
  fusionServiceFactory,
  ingestFileStimulusUseCase,
  cradleConfigFile,
  foundationDocumentStore,
}) {
  return [
    exact("GET", "/api/v1/events", async ({ request }) => ({
      streamResponse: true,
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
      openResponse(response) {
        return sseRuntimeEventTransport.addClient(response, {
          afterEventId: request.headers?.["last-event-id"],
        });
      },
    })),
    exact("GET", "/health", async () =>
      new GetHealthUseCase({ engine }).execute()
    ),
    exact("GET", "/api/v1/cells", async () =>
      new ListCellsUseCase({ engine }).execute()
    ),
    exact("GET", "/api/v1/creations", async () =>
      new ListCreationsUseCase({ engine }).execute()
    ),
    pattern(
      "GET",
      /^\/api\/v1\/creations\/([^/]+)\/preview$/,
      async ({ params }) =>
        new GetCreationPreviewUseCase({ engine }).execute({
          artifactId: params[0],
        })
    ),
    exact("GET", "/api/v1/colony", async () =>
      new GetColonyUseCase({ engine }).execute()
    ),
    exact("GET", "/api/v1/cultivation/status", async () =>
      new GetCultivationStatusUseCase({ engine }).execute()
    ),
    exact("GET", "/api/v1/logs", async () =>
      new ListLogsUseCase({ logBuffer }).execute()
    ),
    exact("GET", "/api/v1/metrics", async () =>
      new ListRuntimeMetricsUseCase({ metrics: engine.runtimeMetrics }).execute()
    ),
    exact("GET", "/api/v1/config", async () =>
      new GetCradleConfigUseCase({ file: cradleConfigFile }).execute()
    ),
    exact("GET", "/api/v1/foundation", async () =>
      new GetFoundationUseCase({ foundationDocumentStore }).execute()
    ),
    pattern(
      "PUT",
      /^\/api\/v1\/foundation\/([^/]+)$/,
      async ({ params, request }) =>
        new UpdateFoundationDocumentUseCase({ foundationDocumentStore }).execute({
          documentId: params[0],
          content: request.body?.content,
          expectedRevision: request.body?.expectedRevision,
        }),
    ),
    exact("GET", "/api/v1/observatory", async () =>
      new GetObservatoryUseCase({ engine }).execute()
    ),
    exact("PUT", "/api/v1/config", async ({ request }) =>
      new UpdateCradleConfigUseCase({ file: cradleConfigFile }).execute({
        config: request.body,
      })
    ),
    exact("GET", "/api/v1/ai/settings", async () =>
      new GetAiSettingsUseCase({
        engine,
        settingsStore: aiSettingsStoreFactory(),
      }).execute()
    ),
    exact("GET", "/api/v1/artifact-types", async () =>
      new ListArtifactTypesUseCase().execute()
    ),
    exact("PUT", "/api/v1/ai/settings", async ({ request }) =>
      new SetAiSettingsUseCase({
        engine,
        settingsStore: aiSettingsStoreFactory(),
      }).execute({
        provider: request.body?.provider,
        model: request.body?.model,
      })
    ),
    exact("DELETE", "/api/v1/logs", async () =>
      new ClearLogsUseCase({ logBuffer }).execute()
    ),
    exact("POST", "/api/v1/cells", async ({ request }) =>
      new CreateCellUseCase({ engine, eventStream }).execute({
        cellId: request.body?.cellId,
      })
    ),
    exact("POST", "/api/v1/stimuli/files", async ({ request, route }) =>
      ingestFileStimulusUseCase.execute({
        fileName: decodeFileNameHeader(request.headers?.["x-cradle-file-name"]),
        mediaType: request.headers?.["content-type"],
        bytes: request.body,
        cellId: route.searchParams.get("cellId"),
        artifactType: request.headers?.["x-cradle-artifact-type"],
      })
    ),
    exact("POST", "/api/v1/cells/activate-all", async () =>
      new SetAllCellsActiveUseCase({ engine, eventStream }).execute({ active: true })
    ),
    exact("POST", "/api/v1/cells/deactivate-all", async () =>
      new SetAllCellsActiveUseCase({ engine, eventStream }).execute({ active: false })
    ),
    exact("POST", "/api/v1/cells/fuse", async ({ request }) => {
      const useCase = new FuseCellsUseCase({
        engine,
        operationGuard: cellOperationGuard,
        fusionServiceFactory,
      });
      const input = {
        parentCellIds: request.body?.parentCellIds,
        childCellId: request.body?.childCellId,
      };
      const prepared = useCase.prepare(input);

      return new StartOperationUseCase({ operationRunner }).execute({
        type: "cell-fusion",
        context: {
          cellIds: [...prepared.normalizedParentIds, prepared.childId],
          childCellId: prepared.childId,
        },
        task: ({ update }) => useCase.execute({ ...input, prepared, onProgress: update }),
      });
    }),
    pattern(
      "POST",
      /^\/api\/v1\/cells\/([^/]+)\/stabilize$/,
      async ({ params }) => {
        const useCase = new StabilizeCellUseCase({
          engine,
          operationGuard: cellOperationGuard,
          stabilizationServiceFactory,
        });
        const input = { cellId: params[0] };
        const prepared = useCase.prepare(input);

        return new StartOperationUseCase({ operationRunner }).execute({
          type: "cell-stabilization",
          context: { cellIds: [prepared.cell.id] },
          task: ({ update }) => useCase.execute({ ...input, prepared, onProgress: update }),
        });
      }
    ),
    pattern(
      "POST",
      /^\/api\/v1\/cells\/([^/]+)\/divide$/,
      async ({ params, request }) => {
        const useCase = new DivideCellUseCase({
          engine,
          operationGuard: cellOperationGuard,
          divisionServiceFactory,
        });
        const input = {
          cellId: params[0],
          childCellId: request.body?.childCellId,
        };
        const prepared = useCase.prepare(input);

        return new StartOperationUseCase({ operationRunner }).execute({
          type: "cell-division",
          context: {
            cellIds: [prepared.parentCell.id, prepared.childId],
            childCellId: prepared.childId,
          },
          task: ({ update }) => useCase.execute({ ...input, prepared, onProgress: update }),
        });
      }
    ),
    pattern(
      "POST",
      /^\/api\/v1\/cells\/([^/]+)\/feed$/,
      async ({ params, request }) =>
        new FeedCellUseCase({ engine, eventStream }).execute({
          cellId: params[0],
          content: request.body?.content,
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/ai$/,
      async ({ params }) =>
        new GetCellAiBindingUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "PUT",
      /^\/api\/v1\/cells\/([^/]+)\/ai$/,
      async ({ params, request }) =>
        new SetCellAiBindingUseCase({ engine, eventStream }).execute({
          cellId: params[0],
          provider: request.body?.provider,
          model: request.body?.model,
          mode: request.body?.mode ?? "pinned",
        })
    ),
    pattern("GET", /^\/api\/v1\/cells\/([^/]+)$/, async ({ params }) =>
      new GetCellUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "POST",
      /^\/api\/v1\/cells\/([^/]+)\/(activate|deactivate)$/,
      async ({ params }) =>
        new SetCellActiveUseCase({ engine, eventStream }).execute({
          cellId: params[0],
          active: params[1] === "activate",
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/workspace$/,
      async ({ params }) =>
        new ListCellWorkspaceUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/workspace\/files$/,
      async ({ params, route }) =>
        new ReadCellWorkspaceFileUseCase({ engine }).execute({
          cellId: params[0],
          path: route.searchParams.get("path"),
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/workspace\/entries$/,
      async ({ params, route }) =>
        new ListCellWorkspaceEntriesUseCase({ engine }).execute({
          cellId: params[0],
          path: route.searchParams.get("path"),
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/workspace\/file$/,
      async ({ params, route }) =>
        new ReadCellWorkspacePreviewUseCase({ engine }).execute({
          cellId: params[0],
          path: route.searchParams.get("path"),
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/workspace\/export$/,
      async ({ params }) =>
        new ExportCellWorkspaceUseCase({ engine }).execute({
          cellId: params[0],
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/artifacts$/,
      async ({ params }) =>
        new ListCellArtifactsUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/artifacts\/([^/]+)\/export$/,
      async ({ params }) =>
        new ExportCellArtifactUseCase({ engine }).execute({
          cellId: params[0],
          artifactId: params[1],
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/artifacts\/([^/]+)$/,
      async ({ params }) =>
        new GetCellArtifactUseCase({ engine }).execute({
          cellId: params[0],
          artifactId: params[1],
        })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/artifacts\/([^/]+)\/stability$/,
      async ({ params }) =>
        new GetCellArtifactStabilityUseCase({ engine }).execute({
          cellId: params[0],
          artifactId: params[1],
        })
    ),
    pattern("GET", /^\/api\/v1\/cells\/([^/]+)\/dna$/, async ({ params }) =>
      new GetCellDnaUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/dna\/history$/,
      async ({ params }) =>
        new GetCellDnaHistoryUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/maturity$/,
      async ({ params }) =>
        new GetCellMaturityUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/lifecycle-decision$/,
      async ({ params, route }) =>
        new GetCellLifecycleDecisionUseCase({ engine }).execute({
          cellId: params[0],
          hasComplementaryCell: parseBoolean(
            route.searchParams.get("hasComplementaryCell")
          ),
          recentFailureRate: parseNumber(
            route.searchParams.get("recentFailureRate"),
            0
          ),
        })
    ),
    pattern("GET", /^\/api\/v1\/cells\/([^/]+)\/tasks$/, async ({ params }) =>
      new ListCellTasksUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/snapshots$/,
      async ({ params }) =>
        new ListCellSnapshotsUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern("GET", /^\/api\/v1\/cells\/([^/]+)\/inbox$/, async ({ params }) =>
      new ListCellInboxUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "GET",
      /^\/api\/v1\/cells\/([^/]+)\/lifecycle\/events$/,
      async ({ params }) =>
        new ListCellLifecycleEventsUseCase({ engine }).execute({
          cellId: params[0],
        })
    ),
    exact("GET", "/api/v1/heartbeat", async () =>
      new GetHeartbeatUseCase({ heartbeatModeStoreFactory }).execute()
    ),
    exact("PUT", "/api/v1/heartbeat/mode", async ({ request }) =>
      new SetHeartbeatModeUseCase({
        heartbeatModeStoreFactory,
        eventStream,
      }).execute({
        mode: request.body?.mode,
      })
    ),
    exact("POST", "/api/v1/heartbeat/runs", async () =>
      new RunHeartbeatUseCase({
        engine,
        heartbeatServiceFactory,
        operationRunner,
      }).execute()
    ),
    exact("GET", "/api/v1/operations", async () =>
      new ListOperationsUseCase({ operationStore }).execute()
    ),
    pattern(
      "GET",
      /^\/api\/v1\/operations\/([^/]+)$/,
      async ({ params }) =>
        new GetOperationUseCase({ operationStore }).execute({
          operationId: params[0],
        })
    ),
  ];
}

function exact(method, pathname, execute) {
  return {
    method,
    match: (route) => route.pathname === pathname ? [] : null,
    execute,
  };
}

function pattern(method, matcher, execute) {
  return {
    method,
    match: (route) => {
      const match = route.pathname.match(matcher);
      return match ? match.slice(1).map(decodeURIComponent) : null;
    },
    execute,
  };
}

function decodeFileNameHeader(value) {
  try {
    return decodeURIComponent(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
}

function parseBoolean(value) {
  return value === "true" || value === "1";
}

function parseNumber(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
