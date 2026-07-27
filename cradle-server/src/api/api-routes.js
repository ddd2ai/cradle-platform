import { CreateCellUseCase } from "../application/create-cell-use-case.js";
import { ClearLogsUseCase } from "../application/clear-logs-use-case.js";
import { ExportCellWorkspaceUseCase } from "../application/export-cell-workspace-use-case.js";
import { GetCellArtifactUseCase } from "../application/get-cell-artifact-use-case.js";
import { GetAiSettingsUseCase } from "../application/get-ai-settings-use-case.js";
import { GetCellDnaUseCase } from "../application/get-cell-dna-use-case.js";
import { GetCellDnaHistoryUseCase } from "../application/get-cell-dna-history-use-case.js";
import { GetCellLifecycleDecisionUseCase } from "../application/get-cell-lifecycle-decision-use-case.js";
import { GetCellMaturityUseCase } from "../application/get-cell-maturity-use-case.js";
import { GetCellArtifactStabilityUseCase } from "../application/get-cell-artifact-stability-use-case.js";
import { GetCellUseCase } from "../application/get-cell-use-case.js";
import { GetColonyUseCase } from "../application/get-colony-use-case.js";
import { GetCultivationStatusUseCase } from "../application/get-cultivation-status-use-case.js";
import { GetHeartbeatUseCase } from "../application/get-heartbeat-use-case.js";
import { GetHealthUseCase } from "../application/get-health-use-case.js";
import { GetOperationUseCase } from "../application/get-operation-use-case.js";
import { HeartbeatModeStore } from "../heartbeat/heartbeat-mode.js";
import { ListCellArtifactsUseCase } from "../application/list-cell-artifacts-use-case.js";
import { ListCellInboxUseCase } from "../application/list-cell-inbox-use-case.js";
import { ListCellLifecycleEventsUseCase } from "../application/list-cell-lifecycle-events-use-case.js";
import { ListCellTasksUseCase } from "../application/list-cell-tasks-use-case.js";
import { ListCellSnapshotsUseCase } from "../application/list-cell-snapshots-use-case.js";
import { ListCellWorkspaceEntriesUseCase } from "../application/list-cell-workspace-entries-use-case.js";
import { ListCellWorkspaceUseCase } from "../application/list-cell-workspace-use-case.js";
import { ListCellsUseCase } from "../application/list-cells-use-case.js";
import { ListLogsUseCase } from "../application/list-logs-use-case.js";
import { ListOperationsUseCase } from "../application/list-operations-use-case.js";
import { OperationRunner } from "../application/operation-runner.js";
import { ReadCellWorkspaceFileUseCase } from "../application/read-cell-workspace-file-use-case.js";
import { ReadCellWorkspacePreviewUseCase } from "../application/read-cell-workspace-preview-use-case.js";
import { RunHeartbeatUseCase } from "../application/run-heartbeat-use-case.js";
import { SetAllCellsActiveUseCase } from "../application/set-all-cells-active-use-case.js";
import { SetAiSettingsUseCase } from "../application/set-ai-settings-use-case.js";
import { SetCellActiveUseCase } from "../application/set-cell-active-use-case.js";
import { SetHeartbeatModeUseCase } from "../application/set-heartbeat-mode-use-case.js";

export function createApiRoutes({
  engine,
  heartbeatModeStoreFactory = () => new HeartbeatModeStore(),
  aiSettingsStoreFactory,
  heartbeatServiceFactory,
  logBuffer,
  operationStore,
  operationRunner = new OperationRunner({ operationStore }),
}) {
  return [
    exact("GET", "/health", async () =>
      new GetHealthUseCase({ engine }).execute()
    ),
    exact("GET", "/api/v1/cells", async () =>
      new ListCellsUseCase({ engine }).execute()
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
    exact("GET", "/api/v1/ai/settings", async () =>
      new GetAiSettingsUseCase({
        engine,
        settingsStore: aiSettingsStoreFactory(),
      }).execute()
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
      new CreateCellUseCase({ engine }).execute({
        cellId: request.body?.cellId,
      })
    ),
    exact("POST", "/api/v1/cells/activate-all", async () =>
      new SetAllCellsActiveUseCase({ engine }).execute({ active: true })
    ),
    exact("POST", "/api/v1/cells/deactivate-all", async () =>
      new SetAllCellsActiveUseCase({ engine }).execute({ active: false })
    ),
    pattern("GET", /^\/api\/v1\/cells\/([^/]+)$/, async ({ params }) =>
      new GetCellUseCase({ engine }).execute({ cellId: params[0] })
    ),
    pattern(
      "POST",
      /^\/api\/v1\/cells\/([^/]+)\/(activate|deactivate)$/,
      async ({ params }) =>
        new SetCellActiveUseCase({ engine }).execute({
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
      new SetHeartbeatModeUseCase({ heartbeatModeStoreFactory }).execute({
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
