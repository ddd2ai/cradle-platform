import { ApiError, mapApiError } from "./api-error.js";
import { AiSettingsStore } from "../ai/ai-settings-store.js";
import { CellOperationGuard } from "../application/cell-operation-guard.js";
import { createApiRoutes } from "./api-routes.js";
import { LogBuffer } from "../application/log-buffer.js";
import { InMemoryOperationStore } from "../application/operation-store.js";
import { ApplicationEventStream } from "../application/application-event-stream.js";

export function createApiHandler({
  engine,
  aiSettingsStoreFactory = () => new AiSettingsStore(),
  heartbeatModeStoreFactory,
  heartbeatServiceFactory,
  eventStream = new ApplicationEventStream(),
  logBuffer = new LogBuffer({ eventStream }),
  operationStore = new InMemoryOperationStore({ eventStream }),
  operationRunner,
  cellOperationGuard = new CellOperationGuard(),
  stabilizationServiceFactory,
  divisionServiceFactory,
  fusionServiceFactory,
  cradleConfigFile,
}) {
  const routes = createApiRoutes({
    engine,
    eventStream,
    aiSettingsStoreFactory,
    heartbeatModeStoreFactory,
    heartbeatServiceFactory,
    logBuffer,
    operationStore,
    operationRunner,
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
