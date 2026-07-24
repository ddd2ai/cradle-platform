import assert from "assert";
import { createApiHandler } from "../src/api/api-handler.js";
import { InMemoryOperationStore } from "../src/application/operation-store.js";
import { OperationRunner } from "../src/application/operation-runner.js";

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
      workspaceSections: {
        notes: ["source.md"],
        decisions: [],
      },
      workspaceFiles: {
        "notes/source.md": "source content",
      },
      dnaVector: {
        PERCEPTION: { strength: 0.8 },
      },
      maturityInfo: {
        percent: 70,
        state: "stable",
      },
      lifecycleDecision: {
        action: "stay",
        confidence: 0.7,
      },
      tasks: [
        {
          id: "task-001",
          title: "Draft plan",
          status: "pending",
        },
      ],
      inbox: [
        {
          id: "msg-001",
          from: "cell-002",
          content: "hello",
        },
      ],
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

const modeStore = {
  mode: "manual",
  getMode: async () => modeStore.mode,
  setMode: async (mode) => {
    const previous = modeStore.mode;
    modeStore.mode = mode;
    return { previous, current: mode };
  },
};
const operationStore = new InMemoryOperationStore({
  now: () => new Date("2026-07-24T10:00:00.000Z"),
});
const operationRunner = new OperationRunner({ operationStore });
const heartbeatCalls = [];
const handler = createApiHandler({
  engine,
  heartbeatModeStoreFactory: () => modeStore,
  heartbeatServiceFactory: () => ({
    beat: async () => {
      heartbeatCalls.push("beat");
      return {
        status: "completed",
        action: "stay",
        mode: modeStore.mode,
      };
    },
  }),
  operationStore,
  operationRunner,
});

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

const workspace = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace",
});

assert.equal(workspace.status, 200);
assert.deepEqual(workspace.body, {
  cellId: "cell-001",
  sections: {
    notes: ["source.md"],
    decisions: [],
  },
});

const workspaceFile = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/files?path=notes%2Fsource.md",
});

assert.equal(workspaceFile.status, 200);
assert.deepEqual(workspaceFile.body, {
  cellId: "cell-001",
  path: "notes/source.md",
  content: "source content",
});

const missingWorkspaceFile = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/files?path=missing.md",
});

assert.equal(missingWorkspaceFile.status, 404);
assert.equal(missingWorkspaceFile.body.error.code, "WORKSPACE_FILE_NOT_FOUND");

const missingWorkspaceFilePath = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/files",
});

assert.equal(missingWorkspaceFilePath.status, 400);
assert.equal(missingWorkspaceFilePath.body.error.code, "WORKSPACE_FILE_PATH_REQUIRED");

const dna = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/dna",
});

assert.equal(dna.status, 200);
assert.deepEqual(dna.body, {
  cellId: "cell-001",
  vector: {
    PERCEPTION: { strength: 0.8 },
  },
});

const maturity = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/maturity",
});

assert.equal(maturity.status, 200);
assert.deepEqual(maturity.body, {
  cellId: "cell-001",
  maturity: {
    percent: 70,
    state: "stable",
  },
});

const lifecycleDecision = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/lifecycle-decision?hasComplementaryCell=true&recentFailureRate=0.2",
});

assert.equal(lifecycleDecision.status, 200);
assert.deepEqual(lifecycleDecision.body, {
  cellId: "cell-001",
  decision: {
    action: "stay",
    confidence: 0.7,
    request: {
      hasComplementaryCell: true,
      recentFailureRate: 0.2,
    },
  },
});

const tasks = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/tasks",
});

assert.equal(tasks.status, 200);
assert.deepEqual(tasks.body, {
  cellId: "cell-001",
  tasks: [
    {
      id: "task-001",
      title: "Draft plan",
      status: "pending",
    },
  ],
});

const inbox = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/inbox",
});

assert.equal(inbox.status, 200);
assert.deepEqual(inbox.body, {
  cellId: "cell-001",
  messages: [
    {
      id: "msg-001",
      from: "cell-002",
      content: "hello",
    },
  ],
});

const heartbeat = await handler({
  method: "GET",
  url: "/api/v1/heartbeat",
});

assert.equal(heartbeat.status, 200);
assert.deepEqual(heartbeat.body, { mode: "manual" });

const heartbeatMode = await handler({
  method: "PUT",
  url: "/api/v1/heartbeat/mode",
  body: { mode: "automatic" },
});

assert.equal(heartbeatMode.status, 200);
assert.deepEqual(heartbeatMode.body, {
  previous: "manual",
  current: "automatic",
});

const invalidHeartbeatMode = await handler({
  method: "PUT",
  url: "/api/v1/heartbeat/mode",
  body: { mode: "fast" },
});

assert.equal(invalidHeartbeatMode.status, 400);
assert.equal(invalidHeartbeatMode.body.error.code, "INVALID_HEARTBEAT_MODE");

const heartbeatRun = await handler({
  method: "POST",
  url: "/api/v1/heartbeat/runs",
});

assert.equal(heartbeatRun.status, 202);
assert.equal(heartbeatRun.body.type, "heartbeat");
assert.equal(heartbeatRun.body.status, "accepted");
assert.ok(heartbeatRun.body.operationId.startsWith("op-"));

await waitForMicrotasks();

const operation = await handler({
  method: "GET",
  url: `/api/v1/operations/${heartbeatRun.body.operationId}`,
});

assert.equal(operation.status, 200);
assert.equal(operation.body.operation.status, "completed");
assert.equal(operation.body.operation.result.action, "stay");
assert.deepEqual(heartbeatCalls, ["beat"]);

const missingOperation = await handler({
  method: "GET",
  url: "/api/v1/operations/op-missing",
});

assert.equal(missingOperation.status, 404);
assert.equal(missingOperation.body.error.code, "OPERATION_NOT_FOUND");

const notFound = await handler({
  method: "GET",
  url: "/missing",
});

assert.equal(notFound.status, 404);
assert.equal(notFound.body.error.code, "ROUTE_NOT_FOUND");
assert.equal(notFound.body.error.message, "Route not found: GET /missing");

console.log("API handler tests passed");

function waitForMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createCell({
  id,
  profile,
  active,
  workspaceSections = {},
  workspaceFiles = {},
  dnaVector = {},
  maturityInfo = {},
  lifecycleDecision = {},
  tasks = [],
  inbox = [],
}) {
  const cell = {
    id,
    name: id,
    profile,
    active,
    getProfile: async () => profile,
    isActive: () => cell.active,
    listWorkspaceSections: async () => workspaceSections,
    readDNAVector: async () => dnaVector,
    getMaturityInfo: async () => maturityInfo,
    getLifecycleDecision: async (request) => ({
      ...lifecycleDecision,
      request,
    }),
    readTasks: async () => tasks,
    readInbox: async () => inbox,
    readWorkspaceFile: async (relativePath) => {
      if (!(relativePath in workspaceFiles)) {
        throw new Error("missing");
      }

      return workspaceFiles[relativePath];
    },
  };

  return cell;
}
