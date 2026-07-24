import { CreateCellUseCase } from "../application/create-cell-use-case.js";
import { GetHealthUseCase } from "../application/get-health-use-case.js";
import { GetCellUseCase } from "../application/get-cell-use-case.js";
import { ListCellsUseCase } from "../application/list-cells-use-case.js";
import { SetCellActiveUseCase } from "../application/set-cell-active-use-case.js";
import { ApiError, mapApiError } from "./api-error.js";

export function createApiHandler({ engine }) {
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
