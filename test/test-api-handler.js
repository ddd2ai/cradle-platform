import assert from "assert";
import { createApiHandler } from "../src/api/api-handler.js";

const engine = {
  activeCellId: "Cradle",
  CRADLE_ID: "Cradle",
  createdCells: [],
  listCellIds: () => ["cell-001", "cell-002"],
  listCells: () => [
    ...cellStore.values(),
  ],
  getCell: (cellId) => engine.listCells().find((cell) => cell.id === cellId) ?? null,
  hasCell: (cellId) => cellStore.has(cellId),
  createCell: async (cellId) => {
    const cell = createCell({
      id: cellId,
      profile: { status: "idle", maturity: 0, generation: 1 },
      active: false,
    });
    cellStore.set(cellId, cell);
    engine.createdCells.push(cellId);
    return cell;
  },
  activateCell: async (cellId) => {
    const cell = cellStore.get(cellId);
    cell.active = true;
    cell.profile.status = "active";
  },
  deactivateCell: async (cellId) => {
    const cell = cellStore.get(cellId);
    cell.active = false;
    cell.profile.status = "idle";
  },
};

const cellStore = new Map([
  [
    "cell-001",
    createCell({
      id: "cell-001",
      profile: {
        status: "active",
        maturity: 10,
        generation: 1,
        responsibilities: ["planning"],
      },
      active: true,
    }),
  ],
  [
    "cell-002",
    createCell({
      id: "cell-002",
      profile: {
        status: "idle",
        maturity: 0,
        generation: 2,
        parent: "cell-001",
      },
      active: false,
    }),
  ],
]);

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

const cells = await handler({
  method: "GET",
  url: "/api/v1/cells",
});

assert.equal(cells.status, 200);
assert.deepEqual(cells.body.cells, [
  {
    cellId: "cell-001",
    name: "cell-001",
    status: "active",
    active: true,
    maturity: 10,
    generation: 1,
    parent: null,
  },
  {
    cellId: "cell-002",
    name: "cell-002",
    status: "idle",
    active: false,
    maturity: 0,
    generation: 2,
    parent: "cell-001",
  },
]);

const cell = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001",
});

assert.equal(cell.status, 200);
assert.equal(cell.body.cell.cellId, "cell-001");
assert.deepEqual(cell.body.cell.responsibilities, ["planning"]);
assert.deepEqual(cell.body.cell.relationships, []);

const missingCell = await handler({
  method: "GET",
  url: "/api/v1/cells/missing-cell",
});

assert.equal(missingCell.status, 404);
assert.equal(missingCell.body.error.code, "CELL_NOT_FOUND");
assert.deepEqual(missingCell.body.error.details, { cellId: "missing-cell" });

const created = await handler({
  method: "POST",
  url: "/api/v1/cells",
  body: { cellId: "cell-003" },
});

assert.equal(created.status, 201);
assert.equal(created.body.cell.cellId, "cell-003");
assert.deepEqual(engine.createdCells, ["cell-003"]);

const duplicate = await handler({
  method: "POST",
  url: "/api/v1/cells",
  body: { cellId: "cell-003" },
});

assert.equal(duplicate.status, 409);
assert.equal(duplicate.body.error.code, "CELL_ALREADY_EXISTS");

const activated = await handler({
  method: "POST",
  url: "/api/v1/cells/cell-002/activate",
});

assert.equal(activated.status, 200);
assert.equal(activated.body.cell.active, true);
assert.equal(activated.body.cell.status, "active");

const deactivated = await handler({
  method: "POST",
  url: "/api/v1/cells/cell-002/deactivate",
});

assert.equal(deactivated.status, 200);
assert.equal(deactivated.body.cell.active, false);
assert.equal(deactivated.body.cell.status, "idle");

const missingActivation = await handler({
  method: "POST",
  url: "/api/v1/cells/missing-cell/activate",
});

assert.equal(missingActivation.status, 404);
assert.equal(missingActivation.body.error.code, "CELL_NOT_FOUND");

const notFound = await handler({
  method: "GET",
  url: "/missing",
});

assert.equal(notFound.status, 404);
assert.equal(notFound.body.error.code, "ROUTE_NOT_FOUND");
assert.equal(notFound.body.error.message, "Route not found: GET /missing");

console.log("API handler tests passed");

function createCell({ id, profile, active }) {
  const cell = {
    id,
    name: id,
    profile,
    active,
    getProfile: async () => profile,
    isActive: () => cell.active,
  };

  return cell;
}
