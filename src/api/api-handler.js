import { GetHealthUseCase } from "../application/get-health-use-case.js";
import { ApiError, mapApiError } from "./api-error.js";

export function createApiHandler({ engine }) {
  return async function handleApiRequest(request) {
    try {
      const route = normalizeRoute(request);

      if (route.method === "GET" && route.pathname === "/health") {
        const result = await new GetHealthUseCase({ engine }).execute();
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
