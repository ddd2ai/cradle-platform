import { CreateCellUseCase } from "../application/create-cell-use-case.js";
import { GetCellDnaUseCase } from "../application/get-cell-dna-use-case.js";
import { GetHeartbeatUseCase } from "../application/get-heartbeat-use-case.js";
import { GetHealthUseCase } from "../application/get-health-use-case.js";
import { GetCellUseCase } from "../application/get-cell-use-case.js";
import { GetCellLifecycleDecisionUseCase } from "../application/get-cell-lifecycle-decision-use-case.js";
import { GetCellMaturityUseCase } from "../application/get-cell-maturity-use-case.js";
import { GetColonyUseCase } from "../application/get-colony-use-case.js";
import { GetOperationUseCase } from "../application/get-operation-use-case.js";
import { HeartbeatModeStore } from "../heartbeat/heartbeat-mode.js";
import { InMemoryOperationStore } from "../application/operation-store.js";
import { ListCellInboxUseCase } from "../application/list-cell-inbox-use-case.js";
import { ListCellLifecycleEventsUseCase } from "../application/list-cell-lifecycle-events-use-case.js";
import { ListCellTasksUseCase } from "../application/list-cell-tasks-use-case.js";
import { ListCellWorkspaceUseCase } from "../application/list-cell-workspace-use-case.js";
import { ListCellsUseCase } from "../application/list-cells-use-case.js";
import { ListOperationsUseCase } from "../application/list-operations-use-case.js";
import { OperationRunner } from "../application/operation-runner.js";
import { ReadCellWorkspaceFileUseCase } from "../application/read-cell-workspace-file-use-case.js";
import { RunHeartbeatUseCase } from "../application/run-heartbeat-use-case.js";
import { SetCellActiveUseCase } from "../application/set-cell-active-use-case.js";
import { SetHeartbeatModeUseCase } from "../application/set-heartbeat-mode-use-case.js";
import { ApiError, mapApiError } from "./api-error.js";

export function createApiHandler({
  engine,
  heartbeatModeStoreFactory = () => new HeartbeatModeStore(),
  heartbeatServiceFactory,
  operationStore = new InMemoryOperationStore(),
  operationRunner = new OperationRunner({ operationStore }),
}) {
  return async function handleApiRequest(request) {
    try {
      const route = normalizeRoute(request);

      if (route.method === "GET" && route.pathname === "/health") {
        const result = await new GetHealthUseCase({ engine }).execute();
        return jsonResponse(200, result);
      }

      if (route.method === "GET" && route.pathname === "/api/v1/cells") {
        const result = await new ListCellsUseCase({ engine }).execute();
        return jsonResponse(200, result);
      }

      if (route.method === "GET" && route.pathname === "/api/v1/colony") {
        const result = await new GetColonyUseCase({ engine }).execute();
        return jsonResponse(200, result);
      }

      if (route.method === "POST" && route.pathname === "/api/v1/cells") {
        const result = await new CreateCellUseCase({ engine }).execute({
          cellId: request.body?.cellId,
        });
        return jsonResponse(201, result);
      }

      const cellMatch = route.pathname.match(/^\/api\/v1\/cells\/([^/]+)$/);

      if (route.method === "GET" && cellMatch) {
        const result = await new GetCellUseCase({ engine }).execute({
          cellId: decodeURIComponent(cellMatch[1]),
        });
        return jsonResponse(200, result);
      }

      const activationMatch =
        route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/(activate|deactivate)$/);

      if (route.method === "POST" && activationMatch) {
        const result = await new SetCellActiveUseCase({ engine }).execute({
          cellId: decodeURIComponent(activationMatch[1]),
          active: activationMatch[2] === "activate",
        });
        return jsonResponse(200, result);
      }

      const workspaceMatch =
        route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/workspace$/);

      if (route.method === "GET" && workspaceMatch) {
        const result = await new ListCellWorkspaceUseCase({ engine }).execute({
          cellId: decodeURIComponent(workspaceMatch[1]),
        });
        return jsonResponse(200, result);
      }

      const workspaceFileMatch =
        route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/workspace\/files$/);

      if (route.method === "GET" && workspaceFileMatch) {
        const result = await new ReadCellWorkspaceFileUseCase({ engine }).execute({
          cellId: decodeURIComponent(workspaceFileMatch[1]),
          path: route.searchParams.get("path"),
        });
        return jsonResponse(200, result);
      }

      const dnaMatch = route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/dna$/);

      if (route.method === "GET" && dnaMatch) {
        const result = await new GetCellDnaUseCase({ engine }).execute({
          cellId: decodeURIComponent(dnaMatch[1]),
        });
        return jsonResponse(200, result);
      }

      const maturityMatch =
        route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/maturity$/);

      if (route.method === "GET" && maturityMatch) {
        const result = await new GetCellMaturityUseCase({ engine }).execute({
          cellId: decodeURIComponent(maturityMatch[1]),
        });
        return jsonResponse(200, result);
      }

      const lifecycleDecisionMatch =
        route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/lifecycle-decision$/);

      if (route.method === "GET" && lifecycleDecisionMatch) {
        const result = await new GetCellLifecycleDecisionUseCase({ engine }).execute({
          cellId: decodeURIComponent(lifecycleDecisionMatch[1]),
          hasComplementaryCell: parseBoolean(
            route.searchParams.get("hasComplementaryCell")
          ),
          recentFailureRate: parseNumber(
            route.searchParams.get("recentFailureRate"),
            0
          ),
        });
        return jsonResponse(200, result);
      }

      const tasksMatch = route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/tasks$/);

      if (route.method === "GET" && tasksMatch) {
        const result = await new ListCellTasksUseCase({ engine }).execute({
          cellId: decodeURIComponent(tasksMatch[1]),
        });
        return jsonResponse(200, result);
      }

      const inboxMatch = route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/inbox$/);

      if (route.method === "GET" && inboxMatch) {
        const result = await new ListCellInboxUseCase({ engine }).execute({
          cellId: decodeURIComponent(inboxMatch[1]),
        });
        return jsonResponse(200, result);
      }

      const lifecycleEventsMatch =
        route.pathname.match(/^\/api\/v1\/cells\/([^/]+)\/lifecycle\/events$/);

      if (route.method === "GET" && lifecycleEventsMatch) {
        const result = await new ListCellLifecycleEventsUseCase({ engine }).execute({
          cellId: decodeURIComponent(lifecycleEventsMatch[1]),
        });
        return jsonResponse(200, result);
      }

      if (route.method === "GET" && route.pathname === "/api/v1/heartbeat") {
        const result = await new GetHeartbeatUseCase({
          heartbeatModeStoreFactory,
        }).execute();
        return jsonResponse(200, result);
      }

      if (route.method === "PUT" && route.pathname === "/api/v1/heartbeat/mode") {
        const result = await new SetHeartbeatModeUseCase({
          heartbeatModeStoreFactory,
        }).execute({
          mode: request.body?.mode,
        });
        return jsonResponse(200, result);
      }

      if (route.method === "POST" && route.pathname === "/api/v1/heartbeat/runs") {
        const result = await new RunHeartbeatUseCase({
          engine,
          heartbeatServiceFactory,
          operationRunner,
        }).execute();
        return jsonResponse(202, result);
      }

      if (route.method === "GET" && route.pathname === "/api/v1/operations") {
        const result = await new ListOperationsUseCase({
          operationStore,
        }).execute();
        return jsonResponse(200, result);
      }

      const operationMatch =
        route.pathname.match(/^\/api\/v1\/operations\/([^/]+)$/);

      if (route.method === "GET" && operationMatch) {
        const result = await new GetOperationUseCase({
          operationStore,
        }).execute({
          operationId: decodeURIComponent(operationMatch[1]),
        });
        return jsonResponse(200, result);
      }

      throw new ApiError({
        status: 404,
        code: "ROUTE_NOT_FOUND",
        message: `Route not found: ${route.method} ${route.pathname}`,
      });
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

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body,
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
