import assert from "assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApiHandler } from "../src/api/api-handler.js";
import { LogBuffer } from "../src/application/log-buffer.js";
import { InMemoryOperationStore } from "../src/application/operation-store.js";
import { OperationRunner } from "../src/application/operation-runner.js";

const engine = {
  activeCellId: "Cradle",
  CRADLE_ID: "Cradle",
  provider: "ollama",
  model: "devstral-small-2:24b",
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
  activateAllCells: async () => {
    for (const cell of cellStore.values()) {
      cell.active = true;
      cell.profile.status = "active";
    }
  },
  deactivateAllCells: async () => {
    for (const cell of cellStore.values()) {
      cell.active = false;
      cell.profile.status = "idle";
    }
  },
  setAiSettings: ({ provider, model }) => {
    engine.provider = provider;
    engine.model = model;
    for (const cell of cellStore.values()) {
      cell.provider = provider;
      cell.model = model;
    }
  },
  getCultivationStatus: () => {
    const activeTickCellIds = [...cellStore.values()]
      .filter((cell) => cell.isTicking)
      .map((cell) => cell.id);

    return {
      status: activeTickCellIds.length > 0 ? "stopping" : "dormant",
      activeCells: [...cellStore.values()].filter((cell) => cell.active).length,
      activeTicks: activeTickCellIds.length,
      runningTasks: activeTickCellIds.length,
      activeTickCellIds,
      startedAt: null,
      stoppingAt: activeTickCellIds.length > 0
        ? "2026-07-25T08:49:00.983Z"
        : null,
    };
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
      dnaHistory: [{ version: 1, reason: "initialization" }],
      maturityInfo: {
        value: 0.7,
        maturity: 0.7,
        percent: 70,
        state: "stable",
        normalizedMagnitude: 0.8,
        temporalVariance: 0.0318,
        convergence: 0.9692,
        sampleSize: 8,
        dominantTrait: "CREATION",
      },
      lifecycleDecision: {
        action: "stay",
        confidence: 0.7,
        reasonCode: "maturity_below_threshold",
        crossTraitVariance: 0.0184,
        recentFailureRate: 0,
        complementaryCellId: null,
      },
      lifecycleView: {
        phase: "Growing",
        health: "Healthy",
        nextEvolution: "Continue",
        convergence: "Converged",
        failureRate: 0,
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
      lifecycleEvents: [
        {
          type: "division",
          status: "completed",
        },
      ],
      artifactSummaries: {
        artifacts: [
          {
            artifactId: "artifact-001",
            type: "document",
            title: "Design",
            status: "completed",
            outputPaths: ["design.md"],
          },
        ],
        errors: [],
      },
      artifacts: {
        "artifact-001": {
          id: "artifact-001",
          type: "document",
          title: "Design",
          status: "completed",
          outputs: [{ kind: "file", path: "design.md", content: "# Design" }],
        },
      },
      stabilityState: {
        artifactId: "artifact-001",
        status: "stable",
        consecutivePassed: 2,
      },
      snapshots: ["snapshot-001", "snapshot-002"],
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
const aiSettingsStore = {
  current: {
    provider: "ollama",
    model: "devstral-small-2:24b",
  },
  options: [
    {
      id: "copilot",
      label: "Copilot",
      models: ["gpt-5.5", "gpt-5.6", "gpt-5-mini"],
    },
    {
      id: "ollama",
      label: "Ollama",
      models: ["devstral-small-2:24b", "gemma3:latest"],
    },
  ],
  getSettings: async () => ({
    provider: aiSettingsStore.current.provider,
    model: aiSettingsStore.current.model,
    options: aiSettingsStore.options,
  }),
  setSettings: async ({ provider, model }) => {
    const option = aiSettingsStore.options.find((item) => item.id === provider);

    if (!option || !option.models.includes(model)) {
      throw new Error(`Invalid AI settings: ${provider}/${model}`);
    }

    const previous = { ...aiSettingsStore.current };
    aiSettingsStore.current = { provider, model };

    return {
      previous,
      current: { ...aiSettingsStore.current },
      options: aiSettingsStore.options,
    };
  },
};
const operationStore = new InMemoryOperationStore({
  now: () => new Date("2026-07-24T10:00:00.000Z"),
});
const operationRunner = new OperationRunner({ operationStore });
const logBuffer = new LogBuffer({
  now: () => new Date("2026-07-25T10:31:21.000Z"),
});
logBuffer.append({ level: "info", args: ["cell-001 tick"] });
logBuffer.append({ level: "warn", args: ["cell-003 idle"] });
const heartbeatCalls = [];
const stabilizationCalls = [];
const divisionCalls = [];
const fusionCalls = [];
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-api-config-"));
const cradleConfigFile = path.join(tempRoot, "cradle-config.json");
await fs.writeFile(
  cradleConfigFile,
  JSON.stringify({
    ai: {
      defaultProvider: "ollama",
      defaultModel: "devstral-small-2:24b",
      timeoutSeconds: 3600,
      maxSourceArtifactOutputLength: 50000,
      maxSourceArtifactContentLength: 30000,
    },
    providers: {
      ollama: { timeoutSeconds: 3600 },
      copilot: { timeoutSeconds: 3600 },
      codex: { timeoutSeconds: 3600 },
      gemini: { timeoutSeconds: 3600 },
    },
    timeouts: {
      reflectionSeconds: 30,
      mavenExecutionSeconds: 3600,
    },
    heartbeat: {
      mode: "manual",
    },
  }),
);
const handler = createApiHandler({
  engine,
  aiSettingsStoreFactory: () => aiSettingsStore,
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
  logBuffer,
  operationStore,
  operationRunner,
  stabilizationServiceFactory: () => ({
    stabilize: async (cell) => {
      stabilizationCalls.push(cell.id);
      return {
        status: "completed",
        diagnosed: true,
        patched: true,
        verified: true,
        result: "stable",
      };
    },
  }),
  divisionServiceFactory: () => ({
    divide: async ({ parentCell, childId }) => {
      divisionCalls.push({ parentCellId: parentCell.id, childId });
      const child = await engine.createCell(childId);
      return { child, complete: true, errors: [] };
    },
  }),
  fusionServiceFactory: () => ({
    fuse: async ({ parentCells, childId }) => {
      fusionCalls.push({
        parentCellIds: parentCells.map((cell) => cell.id),
        childId,
      });
      const child = await engine.createCell(childId);
      return {
        child,
        success: true,
        status: "complete",
        complete: true,
        errors: [],
      };
    },
  }),
  cradleConfigFile,
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

const colony = await handler({
  method: "GET",
  url: "/api/v1/colony",
});

assert.equal(colony.status, 200);
assert.equal(colony.body.activeCellId, "Cradle");
assert.equal(colony.body.cellCount, 2);
assert.equal(colony.body.activeCount, 1);
assert.equal(colony.body.idleCount, 1);
assert.equal(colony.body.cells.length, 2);

cellStore.get("cell-001").isTicking = true;

const cultivationStatus = await handler({
  method: "GET",
  url: "/api/v1/cultivation/status",
});

assert.equal(cultivationStatus.status, 200);
assert.deepEqual(cultivationStatus.body, {
  status: "stopping",
  activeCells: 1,
  activeTicks: 1,
  runningTasks: 1,
  activeTickCellIds: ["cell-001"],
  startedAt: null,
  stoppingAt: "2026-07-25T08:49:00.983Z",
});

cellStore.get("cell-001").isTicking = false;

const logs = await handler({
  method: "GET",
  url: "/api/v1/logs",
});

assert.equal(logs.status, 200);
assert.deepEqual(logs.body.logs, [
  {
    id: 1,
    level: "info",
    timestamp: "2026-07-25T10:31:21.000Z",
    message: "cell-001 tick",
  },
  {
    id: 2,
    level: "warn",
    timestamp: "2026-07-25T10:31:21.000Z",
    message: "cell-003 idle",
  },
]);

const aiSettings = await handler({
  method: "GET",
  url: "/api/v1/ai/settings",
});

assert.equal(aiSettings.status, 200);
assert.deepEqual(aiSettings.body.current, {
  provider: "ollama",
  model: "devstral-small-2:24b",
});
assert.deepEqual(
  aiSettings.body.options.map((option) => option.id),
  ["copilot", "ollama"],
);

const updatedAiSettings = await handler({
  method: "PUT",
  url: "/api/v1/ai/settings",
  body: { provider: "copilot", model: "gpt-5-mini" },
});

assert.equal(updatedAiSettings.status, 200);
assert.deepEqual(updatedAiSettings.body.previous, {
  provider: "ollama",
  model: "devstral-small-2:24b",
});
assert.deepEqual(updatedAiSettings.body.current, {
  provider: "copilot",
  model: "gpt-5-mini",
});
assert.equal(engine.provider, "copilot");
assert.equal(engine.model, "gpt-5-mini");
assert.equal(cellStore.get("cell-001").provider, "copilot");
assert.equal(cellStore.get("cell-001").model, "gpt-5-mini");

const invalidAiSettings = await handler({
  method: "PUT",
  url: "/api/v1/ai/settings",
  body: { provider: "copilot", model: "devstral-small-2:24b" },
});

assert.equal(invalidAiSettings.status, 400);
assert.equal(invalidAiSettings.body.error.code, "INVALID_AI_SETTINGS");

const clearedLogs = await handler({
  method: "DELETE",
  url: "/api/v1/logs",
});

assert.equal(clearedLogs.status, 200);
assert.deepEqual(clearedLogs.body.logs, []);
assert.deepEqual(logBuffer.list(), []);

const cradleConfig = await handler({
  method: "GET",
  url: "/api/v1/config",
});

assert.equal(cradleConfig.status, 200);
assert.deepEqual(cradleConfig.body, {
  ai: {
    defaultProvider: "ollama",
    defaultModel: "devstral-small-2:24b",
    timeoutSeconds: 3600,
    maxSourceArtifactOutputLength: 50000,
    maxSourceArtifactContentLength: 30000,
  },
  providers: {
    ollama: { timeoutSeconds: 3600 },
    copilot: { timeoutSeconds: 3600 },
    codex: { timeoutSeconds: 3600 },
    gemini: { timeoutSeconds: 3600 },
  },
  timeouts: {
    reflectionSeconds: 30,
    mavenExecutionSeconds: 3600,
  },
  heartbeat: {
    mode: "manual",
  },
});

const missingConfigHandler = createApiHandler({
  engine,
  cradleConfigFile: path.join(tempRoot, "missing-config.json"),
});
const missingConfig = await missingConfigHandler({
  method: "GET",
  url: "/api/v1/config",
});

assert.equal(missingConfig.status, 500);
assert.equal(missingConfig.body.error.code, "CRADLE_CONFIG_NOT_FOUND");

const invalidConfigFile = path.join(tempRoot, "invalid-config.json");
await fs.writeFile(invalidConfigFile, "{ invalid json");
const invalidConfigHandler = createApiHandler({
  engine,
  cradleConfigFile: invalidConfigFile,
});
const invalidConfig = await invalidConfigHandler({
  method: "GET",
  url: "/api/v1/config",
});

assert.equal(invalidConfig.status, 500);
assert.equal(invalidConfig.body.error.code, "CRADLE_CONFIG_INVALID_JSON");

const updatedCradleConfig = await handler({
  method: "PUT",
  url: "/api/v1/config",
  body: {
    ai: {
      defaultProvider: "copilot",
      defaultModel: "gpt-5-mini",
      timeoutSeconds: 1800,
      maxSourceArtifactOutputLength: 64000,
      maxSourceArtifactContentLength: 32000,
    },
    providers: {
      ollama: { timeoutSeconds: 3601 },
      copilot: { timeoutSeconds: 3602 },
      codex: { timeoutSeconds: 3603 },
      gemini: { timeoutSeconds: 3604 },
    },
    timeouts: {
      reflectionSeconds: 45,
      mavenExecutionSeconds: 2400,
    },
    heartbeat: {
      mode: "auto",
    },
  },
});

assert.equal(updatedCradleConfig.status, 200);
assert.deepEqual(updatedCradleConfig.body.ai, {
  defaultProvider: "copilot",
  defaultModel: "gpt-5-mini",
  timeoutSeconds: 1800,
  maxSourceArtifactOutputLength: 64000,
  maxSourceArtifactContentLength: 32000,
});
assert.deepEqual(updatedCradleConfig.body.heartbeat, { mode: "auto" });
const persistedCradleConfig = JSON.parse(await fs.readFile(cradleConfigFile, "utf8"));
assert.deepEqual(persistedCradleConfig, updatedCradleConfig.body);
assert.match(
  await fs.readFile(cradleConfigFile, "utf8"),
  /\n  "ai": \{/,
);

const invalidUpdate = await handler({
  method: "PUT",
  url: "/api/v1/config",
  body: {
    ...updatedCradleConfig.body,
    ai: {
      ...updatedCradleConfig.body.ai,
      defaultProvider: "openai",
    },
  },
});

assert.equal(invalidUpdate.status, 400);
assert.equal(invalidUpdate.body.error.code, "INVALID_CRADLE_CONFIG");

const invalidLimitUpdate = await handler({
  method: "PUT",
  url: "/api/v1/config",
  body: {
    ...updatedCradleConfig.body,
    ai: {
      ...updatedCradleConfig.body.ai,
      maxSourceArtifactOutputLength: 100,
      maxSourceArtifactContentLength: 101,
    },
  },
});

assert.equal(invalidLimitUpdate.status, 400);
assert.equal(invalidLimitUpdate.body.error.code, "INVALID_CRADLE_CONFIG");

const cell = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001",
});

assert.equal(cell.status, 200);
assert.equal(cell.body.cell.cellId, "cell-001");
assert.deepEqual(cell.body.cell.lifecycle, {
  phase: "Growing",
  health: "Healthy",
  nextEvolution: "Continue",
  convergence: "Converged",
  failureRate: 0,
});
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

const activatedAll = await handler({
  method: "POST",
  url: "/api/v1/cells/activate-all",
});

assert.equal(activatedAll.status, 200);
assert.equal(activatedAll.body.cells.length, 3);
assert.equal(activatedAll.body.cells.every((cell) => cell.active), true);

const deactivatedAll = await handler({
  method: "POST",
  url: "/api/v1/cells/deactivate-all",
});

assert.equal(deactivatedAll.status, 200);
assert.equal(deactivatedAll.body.cells.length, 3);
assert.equal(deactivatedAll.body.cells.every((cell) => !cell.active), true);

await engine.activateCell("cell-001");

const workspace = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace",
});

assert.equal(workspace.status, 200);
assert.deepEqual(workspace.body, {
  cellId: "cell-001",
  displayPath: "cells/cell-001/workspace",
  exists: true,
  readable: true,
  sections: {
    notes: ["source.md"],
    decisions: [],
  },
});

const workspaceEntries = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/entries?path=notes",
});

assert.equal(workspaceEntries.status, 200);
assert.deepEqual(workspaceEntries.body, {
  cellId: "cell-001",
  path: "notes",
  entries: [
    {
      name: "source.md",
      path: "notes/source.md",
      type: "file",
      size: 14,
      mimeType: "text/markdown",
      modifiedAt: "2026-07-25T10:31:21.000Z",
      hasChildren: false,
    },
  ],
});

const invalidWorkspaceEntries = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/entries?path=..%2Foutside",
});

assert.equal(invalidWorkspaceEntries.status, 400);
assert.equal(invalidWorkspaceEntries.body.error.code, "INVALID_WORKSPACE_PATH");

const workspacePreview = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/file?path=notes%2Fsource.md",
});

assert.equal(workspacePreview.status, 200);
assert.deepEqual(workspacePreview.body, {
  cellId: "cell-001",
  name: "source.md",
  path: "notes/source.md",
  mimeType: "text/markdown",
  size: 14,
  modifiedAt: "2026-07-25T10:31:21.000Z",
  encoding: "utf-8",
  content: "source content",
  truncated: false,
  previewable: true,
});

const workspaceExport = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/workspace/export",
});

assert.equal(workspaceExport.status, 200);
assert.equal(workspaceExport.headers["content-type"], "application/zip");
assert.equal(
  workspaceExport.headers["content-disposition"],
  'attachment; filename="cell-001-workspace.zip"'
);
assert.equal(Buffer.isBuffer(workspaceExport.body), true);
assert.deepEqual(workspaceExport.body, Buffer.from("zip"));

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

const dnaHistory = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/dna/history",
});

assert.equal(dnaHistory.status, 200);
assert.deepEqual(dnaHistory.body, {
  cellId: "cell-001",
  history: [{ version: 1, reason: "initialization" }],
});

const maturity = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/maturity",
});

assert.equal(maturity.status, 200);
assert.deepEqual(maturity.body, {
  cellId: "cell-001",
  maturity: {
    value: 0.7,
    maturity: 0.7,
    percent: 70,
    state: "stable",
    normalizedMagnitude: 0.8,
    temporalVariance: 0.0318,
    convergence: 0.9692,
    sampleSize: 8,
    dominantTrait: "CREATION",
  },
});

const lifecycleDecision = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/lifecycle-decision?hasComplementaryCell=true&recentFailureRate=0.2",
});

assert.equal(lifecycleDecision.status, 200);
assert.deepEqual(lifecycleDecision.body, {
  cellId: "cell-001",
  status: "active",
  lifecycle: {
    phase: "Growing",
    health: "Healthy",
    nextEvolution: "Continue",
    convergence: "Converged",
    failureRate: 0,
  },
  decision: {
    action: "stay",
    reason: "maturity_below_threshold",
    crossTraitVariance: 0.0184,
    recentFailureRate: 0,
    complementaryCellId: null,
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

const lifecycleEvents = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/lifecycle/events",
});

assert.equal(lifecycleEvents.status, 200);
assert.deepEqual(lifecycleEvents.body, {
  cellId: "cell-001",
  events: [
    {
      type: "division",
      status: "completed",
    },
  ],
});

const artifacts = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/artifacts",
});

assert.equal(artifacts.status, 200);
assert.deepEqual(artifacts.body, {
  cellId: "cell-001",
  artifacts: [
    {
      artifactId: "artifact-001",
      type: "document",
      title: "Design",
      status: "completed",
      outputPaths: ["design.md"],
    },
  ],
  errors: [],
});

const artifact = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/artifacts/artifact-001",
});

assert.equal(artifact.status, 200);
assert.equal(artifact.body.artifact.id, "artifact-001");

const stability = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/artifacts/artifact-001/stability",
});

assert.equal(stability.status, 200);
assert.deepEqual(stability.body, {
  cellId: "cell-001",
  artifactId: "artifact-001",
  state: {
    artifactId: "artifact-001",
    status: "stable",
    consecutivePassed: 2,
  },
});

const missingStability = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/artifacts/missing-artifact/stability",
});

assert.equal(missingStability.status, 404);
assert.equal(missingStability.body.error.code, "STABILITY_STATE_NOT_FOUND");

const snapshots = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/snapshots",
});

assert.equal(snapshots.status, 200);
assert.deepEqual(snapshots.body, {
  cellId: "cell-001",
  snapshots: ["snapshot-001", "snapshot-002"],
});

const missingArtifact = await handler({
  method: "GET",
  url: "/api/v1/cells/cell-001/artifacts/missing-artifact",
});

assert.equal(missingArtifact.status, 404);
assert.equal(missingArtifact.body.error.code, "ARTIFACT_NOT_FOUND");

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

const operations = await handler({
  method: "GET",
  url: "/api/v1/operations",
});

assert.equal(operations.status, 200);
assert.equal(operations.body.operations.length, 1);
assert.equal(operations.body.operations[0].operationId, heartbeatRun.body.operationId);

const missingOperation = await handler({
  method: "GET",
  url: "/api/v1/operations/op-missing",
});

assert.equal(missingOperation.status, 404);
assert.equal(missingOperation.body.error.code, "OPERATION_NOT_FOUND");

const stabilized = await handler({
  method: "POST",
  url: "/api/v1/cells/cell-001/stabilize",
});

assert.equal(stabilized.status, 200);
assert.deepEqual(stabilized.body, {
  cellId: "cell-001",
  status: "completed",
  diagnosed: true,
  patched: true,
  verified: true,
  result: "stable",
});
assert.deepEqual(stabilizationCalls, ["cell-001"]);

const missingStabilization = await handler({
  method: "POST",
  url: "/api/v1/cells/missing-cell/stabilize",
});

assert.equal(missingStabilization.status, 404);
assert.equal(
  missingStabilization.body.error.code,
  "SELECTED_CELL_NOT_FOUND",
);

const divided = await handler({
  method: "POST",
  url: "/api/v1/cells/cell-001/divide",
  body: { childCellId: "cell-divided" },
});

assert.equal(divided.status, 200);
assert.deepEqual(divided.body, {
  parentCellId: "cell-001",
  childCellId: "cell-divided",
  status: "completed",
  complete: true,
  errors: [],
});
assert.deepEqual(divisionCalls, [
  { parentCellId: "cell-001", childId: "cell-divided" },
]);

const duplicateDivision = await handler({
  method: "POST",
  url: "/api/v1/cells/cell-001/divide",
  body: { childCellId: "cell-divided" },
});

assert.equal(duplicateDivision.status, 409);
assert.equal(
  duplicateDivision.body.error.code,
  "CHILD_CELL_ALREADY_EXISTS",
);

const fused = await handler({
  method: "POST",
  url: "/api/v1/cells/fuse",
  body: {
    parentCellIds: ["cell-001", "cell-002"],
    childCellId: "cell-fused",
  },
});

assert.equal(fused.status, 200);
assert.deepEqual(fused.body, {
  parentCellIds: ["cell-001", "cell-002"],
  childCellId: "cell-fused",
  status: "completed",
  complete: true,
  errors: [],
});
assert.deepEqual(fusionCalls, [
  {
    parentCellIds: ["cell-001", "cell-002"],
    childId: "cell-fused",
  },
]);

const duplicateParents = await handler({
  method: "POST",
  url: "/api/v1/cells/fuse",
  body: {
    parentCellIds: ["cell-001", "cell-001"],
    childCellId: "cell-invalid-fusion",
  },
});

assert.equal(duplicateParents.status, 400);
assert.equal(duplicateParents.body.error.code, "DUPLICATE_PARENT_IDS");

const invalidChildId = await handler({
  method: "POST",
  url: "/api/v1/cells/cell-001/divide",
  body: { childCellId: "../invalid" },
});

assert.equal(invalidChildId.status, 400);
assert.equal(invalidChildId.body.error.code, "INVALID_CHILD_CELL_ID");

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
  dnaHistory = [],
  maturityInfo = {},
  lifecycleDecision = {},
  lifecycleView = {},
  tasks = [],
  inbox = [],
  lifecycleEvents = [],
  artifactSummaries = { artifacts: [], errors: [] },
  artifacts = {},
  stabilityState = null,
  snapshots = [],
}) {
  const cell = {
    id,
    name: id,
    profile,
    active,
    getProfile: async () => profile,
    isActive: () => cell.active,
    getWorkspaceMetadata: async () => ({
      exists: true,
      readable: true,
    }),
    listWorkspaceSections: async () => workspaceSections,
    listWorkspaceEntries: async (relativePath = "") => {
      if (relativePath.includes("..")) {
        throw new Error("Invalid path outside cell directory");
      }

      return Object.entries(workspaceFiles)
        .filter(([workspacePath]) => pathDirname(workspacePath) === relativePath)
        .map(([workspacePath, content]) => ({
          name: pathBasename(workspacePath),
          path: workspacePath,
          type: "file",
          size: content.length,
          mimeType: workspacePath.endsWith(".md")
            ? "text/markdown"
            : "text/plain",
          modifiedAt: "2026-07-25T10:31:21.000Z",
          hasChildren: false,
        }));
    },
    readDNAVector: async () => dnaVector,
    readDNAHistory: async () => dnaHistory,
    getMaturityInfo: async () => maturityInfo,
    getLifecycleDecision: async (request) => ({
      ...lifecycleDecision,
      request,
    }),
    getLifecycleView: async () => lifecycleView,
    readTasks: async () => tasks,
    readInbox: async () => inbox,
    readLifecycleEvents: async () => lifecycleEvents,
    artifactStore: {
      listArtifactSummaries: async () => artifactSummaries,
      readArtifact: async (artifactId) => {
        if (!(artifactId in artifacts)) {
          throw new Error("missing");
        }

        return artifacts[artifactId];
      },
    },
    stabilityStore: {
      getArtifactState: async (artifactId) =>
        artifactId === stabilityState?.artifactId ? stabilityState : null,
    },
    listSnapshots: async () => snapshots,
    readWorkspaceFile: async (relativePath) => {
      if (!(relativePath in workspaceFiles)) {
        throw new Error("missing");
      }

      return workspaceFiles[relativePath];
    },
    readWorkspaceFilePreview: async (relativePath) => {
      if (!(relativePath in workspaceFiles)) {
        throw new Error("missing");
      }

      return {
        name: pathBasename(relativePath),
        path: relativePath,
        mimeType: relativePath.endsWith(".md") ? "text/markdown" : "text/plain",
        size: workspaceFiles[relativePath].length,
        modifiedAt: "2026-07-25T10:31:21.000Z",
        encoding: "utf-8",
        content: workspaceFiles[relativePath],
        truncated: false,
        previewable: true,
      };
    },
    exportWorkspaceZip: async ({ rootName }) => {
      assert.equal(rootName, `${id}-workspace`);
      return Buffer.from("zip");
    },
  };

  return cell;
}

function pathDirname(workspacePath) {
  const parts = workspacePath.split("/");
  parts.pop();
  return parts.join("/");
}

function pathBasename(workspacePath) {
  return workspacePath.split("/").at(-1);
}
