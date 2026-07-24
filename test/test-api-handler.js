import assert from "assert";
import { createApiHandler } from "../src/api/api-handler.js";

const engine = {
  activeCellId: "Cradle",
  listCellIds: () => ["cell-001", "cell-002"],
};

const handler = createApiHandler({ engine });

const health = await handler({
  method: "GET",
  url: "/health",
});

assert.equal(health.status, 200);
assert.equal(health.headers["content-type"], "application/json; charset=utf-8");
assert.deepEqual(health.body, {
  status: "ok",
  engineInitialized: true,
  cellCount: 2,
  activeCellId: "Cradle",
});

const notFound = await handler({
  method: "GET",
  url: "/missing",
});

assert.equal(notFound.status, 404);
assert.equal(notFound.body.error.code, "ROUTE_NOT_FOUND");
assert.equal(notFound.body.error.message, "Route not found: GET /missing");

console.log("API handler tests passed");
