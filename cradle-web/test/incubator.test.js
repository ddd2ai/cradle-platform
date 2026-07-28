import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  activateCell,
  deactivateCell,
  divideCell,
  fuseCells,
  stabilizeCell,
  startCultivation,
} from "../src/api/cradleClient.js";
import { DNA_DIMENSION_ORDER, mapDnaDimensions } from "../src/components/cell/dna-dimensions.js";
import { CELL_PALETTES } from "../src/constants/incubatorVisuals.js";

let vite;
let IncubatorDish;
let IncubatorWorkspace;
let CellOperationDialogs;
let CellControlCard;
let SelectedCellPanel;
let Sidebar;
let SettingsPage;
let LifecycleCard;
let MaturityCard;
let DnaDimensionsCard;
let getIncubatorSummary;
let mapCellActivity;
let mapCellToVisualState;
let normalizePercentage;
let formatStabilizeMessage;

before(async () => {
  vite = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  ({ IncubatorDish } = await vite.ssrLoadModule(
    "/src/components/incubator/IncubatorDish.jsx",
  ));
  ({ IncubatorWorkspace } = await vite.ssrLoadModule(
    "/src/components/incubator/IncubatorWorkspace.jsx",
  ));
  ({ CellOperationDialogs } = await vite.ssrLoadModule(
    "/src/components/incubator/CellOperationDialogs.jsx",
  ));
  ({ CellControlCard } = await vite.ssrLoadModule(
    "/src/components/incubator/CellControlCard.jsx",
  ));
  ({ SelectedCellPanel } = await vite.ssrLoadModule(
    "/src/components/incubator/SelectedCellPanel.jsx",
  ));
  ({ Sidebar } = await vite.ssrLoadModule(
    "/src/components/Sidebar.jsx",
  ));
  ({ SettingsPage } = await vite.ssrLoadModule(
    "/src/pages/SettingsPage.jsx",
  ));
  ({ LifecycleCard } = await vite.ssrLoadModule(
    "/src/components/cell/LifecycleCard.jsx",
  ));
  ({ MaturityCard } = await vite.ssrLoadModule(
    "/src/components/cell/MaturityCard.jsx",
  ));
  ({ DnaDimensionsCard } = await vite.ssrLoadModule(
    "/src/components/cell/DnaDimensionsCard.jsx",
  ));
  ({ getIncubatorSummary } = await vite.ssrLoadModule(
    "/src/domain/incubatorSummary.js",
  ));
  ({
    mapCellActivity,
    mapCellToVisualState,
    normalizePercentage,
  } = await vite.ssrLoadModule("/src/domain/cellVisualMapper.js"));
  ({ formatStabilizeMessage } = await vite.ssrLoadModule(
    "/src/domain/stabilizationResult.js",
  ));
});

after(async () => {
  await vite?.close();
});

test("IncubatorDish renders one selectable organism per visible Cell", () => {
  const markup = renderDish(createCells(5));
  assert.equal((markup.match(/data-cell-id=/g) ?? []).length, 5);
});

test("Cell detail keeps the shared Sidebar and selected Cell state", () => {
  const markup = renderToStaticMarkup(
    React.createElement(Sidebar, {
      cells: createCells(3),
      selectedCellId: "B01",
      selectedSection: "cell",
      onSelectCell: () => {},
      onSelectSection: () => {},
      onCreateCell: () => {},
      isLoading: false,
      error: null,
    }),
  );

  for (const label of [
    "New Cell",
    "Overview",
    "Incubator",
    "Observatory",
    "Artifacts",
    "Logs",
    "Cells",
    "Settings",
    "Cradle Platform",
  ]) {
    assert.match(markup, new RegExp(label));
  }

  assert.match(markup, /cell-item selected/);
  assert.match(markup, /\/cells\/cell-green\.webp/);
  assert.doesNotMatch(markup, /cradle-nav-item selected/);
});

test("Sidebar highlights Settings when the Settings page is selected", () => {
  const markup = renderToStaticMarkup(
    React.createElement(Sidebar, {
      cells: createCells(1),
      selectedCellId: null,
      selectedSection: "settings",
      onSelectCell: () => {},
      onSelectSection: () => {},
      onCreateCell: () => {},
      isLoading: false,
      error: null,
    }),
  );

  assert.match(markup, /sidebar-footer-button selected/);
  assert.doesNotMatch(markup, /cradle-nav-item selected/);
});

test("SettingsPage renders the mock Runtime settings", () => {
  const markup = renderToStaticMarkup(React.createElement(SettingsPage));

  for (const label of [
    "Runtime",
    "LLM Providers",
    "Cultivation",
    "Advanced",
    "Default provider, model, execution limits, and operation timeouts.",
    "Default Provider",
    "Ollama",
    "Codex",
    "Gemini",
    "Default Model",
    "devstral-small-2:24b",
    "gemma3:latest",
    "Default Timeout",
    "3600",
    "Source Artifact Output Limit",
    "50000",
    "Source Artifact Content Limit",
    "30000",
    "Reflection",
    "30",
    "Maven Execution",
    "No unsaved changes",
    "Reset",
    "Save changes",
  ]) {
    assert.match(markup, new RegExp(label));
  }

  assert.doesNotMatch(markup, /cradle-config\.json/);
  assert.doesNotMatch(markup, />Timeouts</);
});

test("SettingsPage renders the mock provider overrides", () => {
  const markup = renderToStaticMarkup(
    React.createElement(SettingsPage, { initialSectionId: "providers" }),
  );

  for (const label of [
    "Ollama Provider",
    "Copilot Provider",
    "Codex Provider",
    "Gemini Provider",
    "3600",
    "seconds",
    "No unsaved changes",
  ]) {
    assert.match(markup, new RegExp(label));
  }
});

test("SettingsPage renders the mock cultivation settings", () => {
  const markup = renderToStaticMarkup(
    React.createElement(SettingsPage, { initialSectionId: "cultivation" }),
  );

  for (const label of [
    "Cultivation",
    "Mode",
    "Manual",
    "Auto",
    "Runs only when cultivation is triggered explicitly.",
    "Runs cultivation on a configured schedule.",
  ]) {
    assert.match(markup, new RegExp(label));
  }
});

test("SettingsPage renders the mock advanced configuration source", () => {
  const markup = renderToStaticMarkup(
    React.createElement(SettingsPage, { initialSectionId: "advanced" }),
  );

  for (const label of [
    "Configuration",
    "Source",
    "cradle-server/config/cradle-config.json",
    "Configuration editing through the raw JSON file is not available yet.",
  ]) {
    assert.match(markup, new RegExp(label.replaceAll(".", "\\.")));
  }
});

test("IncubatorDish limits the primary field to five Cells", () => {
  const markup = renderDish(createCells(13));
  assert.equal((markup.match(/data-cell-id=/g) ?? []).length, 5);
  assert.match(markup, /\+8/);
});

test("IncubatorDish marks the selected Cell", () => {
  const markup = renderDish(createCells(3), { selectedCellId: "B02" });
  assert.match(markup, /data-cell-id="B02"[^>]*aria-pressed="true"/);
});

test("FloatingCell renders independent selection and organism animation layers", () => {
  const markup = renderDish(createCells(1));
  assert.match(markup, /floating-cell__selection/);
  assert.match(markup, /floating-cell__organism/);
  assert.match(markup, /floating-cell__texture/);
  assert.match(markup, /\/cells\/cell-[a-z]+\.webp/);
  assert.match(markup, /--drift-duration:11.4s/);
  assert.match(markup, /--breathe-duration:5.4s/);
  assert.match(markup, /--drift-x:8px/);
  assert.match(markup, /--drift-y:-12px/);
  assert.match(markup, /--cell-rim:/);
  assert.match(markup, /--cell-deep:/);
  assert.match(markup, /--cell-glow:rgba\(/);
});

test("Cell palettes expose one shared six-token material contract", () => {
  assert.deepEqual(Object.keys(CELL_PALETTES), [
    "purple",
    "cyan",
    "green",
    "blue",
    "amber",
  ]);

  for (const palette of Object.values(CELL_PALETTES)) {
    assert.deepEqual(Object.keys(palette), [
      "primary",
      "secondary",
      "core",
      "rim",
      "deep",
      "glow",
    ]);
  }
});

test("IncubatorDish applies the motion-paused class without changing Cell state", () => {
  const markup = renderDish(createCells(2), { isMotionPaused: true });
  assert.match(markup, /incubator-dish is-motion-paused/);
  assert.equal((markup.match(/data-cell-id=/g) ?? []).length, 2);
});

test("IncubatorDish renders an empty state when no Cells exist", () => {
  const markup = renderDish([]);
  assert.match(markup, /No living cells yet/);
  assert.match(markup, /New Cell/);
});

test("IncubatorDish preserves its visual shell when the API fails", () => {
  const markup = renderDish([], { error: "offline" });
  assert.match(markup, /incubator-dish__liquid/);
  assert.match(markup, /incubator-dish__bottom-reflection/);
  assert.match(markup, /Unable to load cells/);
});

test("Incubator workspace renders only incubator controls in the bottom dock", () => {
  const markup = renderWorkspace([
    { id: "B01", status: "active", maturity: 10 },
    { id: "B02", status: "idle", maturity: 40 },
    { id: "B03", status: "running", maturity: "not available" },
  ]);

  for (const label of ["Cultivate", "Stabilize", "Divide", "Fuse"]) {
    assert.match(markup, new RegExp(`>${label}<`));
  }

  assert.doesNotMatch(markup, />Copilot</);
  assert.doesNotMatch(markup, />gpt-5-mini</);
  assert.doesNotMatch(markup, />Provider</);
  assert.doesNotMatch(markup, />Model</);
  assert.match(markup, />3<\/dd><dt>Total Cells</);
  assert.match(markup, />1<\/dd><dt>Active Cells</);
  assert.match(markup, />1<\/dd><dt>Idle Cells</);
  assert.match(markup, />25%<\/dd><dt>Average Maturity</);
  assert.match(markup, /Tip: Click a Cell to inspect its details/);
  assert.doesNotMatch(markup, /environment-overlay-card/);
  assert.doesNotMatch(markup, /id="environment-menu"/);
  assert.doesNotMatch(markup, /Show Environment Card|Hide Environment Card/);
  assert.doesNotMatch(markup, />Cultivation</);
  assert.doesNotMatch(markup, />DNA</);
  assert.doesNotMatch(markup, />Workspace</);
  assert.doesNotMatch(markup, />Artifacts</);
  assert.doesNotMatch(markup, />Logs</);
  assert.doesNotMatch(markup, />Environment<\/dt>/);
  assert.doesNotMatch(markup, />Alerts<\/dt>/);
  assert.doesNotMatch(markup, />Total Runtime<\/dt>/);
  assert.doesNotMatch(markup, /98%|12h 34m/);
  assert.doesNotMatch(markup, /Java 21/);
  assert.doesNotMatch(markup, /Spring Boot 3/);
  assert.doesNotMatch(markup, /Hexagonal/);
});

test("Cell operations are disabled without a selected Cell", () => {
  const markup = renderWorkspace(createCells(2), { selectedCellId: null });

  for (const label of ["Stabilize", "Divide", "Fuse"]) {
    assert.match(
      markup,
      new RegExp(`<button type="button" class="cradle-dock-item" disabled="">[\\s\\S]*?>${label}<`),
    );
  }

  assert.match(markup, /title="Select a cell first"/);
});

test("Fuse is disabled when no other Cell exists", () => {
  const markup = renderWorkspace(createCells(1));
  assert.match(markup, /title="At least two cells are required"/);
});

test("Stabilize dialog confirms the selected Cell before calling the API", () => {
  const markup = renderOperationDialog("stabilize");
  assert.match(markup, /Stabilize Cell/);
  assert.match(markup, /Diagnose, repair and verify B01\./);
  assert.match(markup, /may update the Cell workspace and execute validation/);
});

test("Stabilize feedback distinguishes repair from diagnosis-only results", () => {
  assert.equal(
    formatStabilizeMessage("B01", {
      diagnosed: true,
      patched: false,
    }),
    "Cell B01 checked — no repair was required.",
  );
  assert.equal(
    formatStabilizeMessage("B01", {
      diagnosed: true,
      patched: true,
      diagnosis: { artifactId: "artifact-001" },
    }),
    "Cell B01 repaired artifact-001 and verified stable.",
  );
});

test("Divide dialog keeps the parent read-only and asks for a child ID", () => {
  const markup = renderOperationDialog("divide");
  assert.match(markup, /Parent Cell/);
  assert.match(markup, /<strong>B01<\/strong>/);
  assert.match(markup, /Child Cell ID/);
  assert.match(markup, /value="cell-003"/);
});

test("Fuse confirmation preserves selected parents and child input", () => {
  const markup = renderOperationDialog("fuse");
  assert.match(markup, /Fuse Cells/);
  assert.match(markup, /<code>B01<\/code>/);
  assert.match(markup, /<code>cell-001<\/code>/);
  assert.match(markup, /<code>cell-002<\/code>/);
  assert.match(markup, /value="cell-003"/);
});

test("Incubator summary counts only backend active and idle statuses", () => {
  const summary = getIncubatorSummary([
    { status: "active", maturity: 10 },
    { status: "idle", maturity: 20 },
    { status: "running", maturity: 30 },
    { status: "error", maturity: 40 },
    { status: "stopped", maturity: 50 },
  ]);

  assert.equal(summary.totalCells, 5);
  assert.equal(summary.activeCells, 1);
  assert.equal(summary.idleCells, 1);
  assert.equal(summary.averageMaturityLabel, "30%");
});

test("Incubator summary treats loading and error as unavailable data", () => {
  const summary = getIncubatorSummary(
    [{ status: "active", maturity: 50 }],
    { unavailable: true },
  );

  assert.equal(summary.totalCells, null);
  assert.equal(summary.activeCells, null);
  assert.equal(summary.idleCells, null);
  assert.equal(summary.averageMaturityLabel, "--");
});

test("Incubator summary converts 0 to 1 maturity values to percentages", () => {
  const summary = getIncubatorSummary([
    { status: "active", maturity: 0.25 },
    { status: "idle", maturity: 0.75 },
    { status: "idle", maturity: Number.NaN },
    { status: "idle", maturity: null },
  ]);

  assert.equal(summary.averageMaturityLabel, "50%");
});

test("Selected Cell details do not render a separate bottom action bar", () => {
  const cell = { id: "B01", name: "B01", status: "active", maturity: 0.25 };
  const visual = mapCellToVisualState(cell);
  const markup = renderToStaticMarkup(
    React.createElement(SelectedCellPanel, {
      cell,
      visual,
      isLoading: false,
      error: null,
      activeAction: null,
      actionMessage: null,
      actionError: null,
      onActivate: () => {},
      onDeactivate: () => {},
    }),
  );

  assert.doesNotMatch(markup, /cell-action-bar/);
  assert.doesNotMatch(markup, />Divide</);
  assert.doesNotMatch(markup, />Fuse</);
  assert.doesNotMatch(markup, />Stabilize</);
});

test("maturity fractions normalize to percentages", () => {
  assert.equal(normalizePercentage(0.25), 25);
  assert.equal(normalizePercentage(25), 25);
  assert.equal(normalizePercentage(null), null);
});

test("MaturityCard renders 0.25 as 25 percent", () => {
  const markup = renderToStaticMarkup(
    React.createElement(MaturityCard, {
      maturity: { value: 0.25, state: "seed" },
    }),
  );
  assert.match(markup, /25%/);
});

test("MaturityCard rejects NaN instead of exposing invalid data", () => {
  const markup = renderToStaticMarkup(
    React.createElement(MaturityCard, {
      maturity: { value: Number.NaN, state: "seed" },
    }),
  );
  assert.match(markup, />--</);
  assert.doesNotMatch(markup, /NaN/);
});

test("DNA dimensions always follow the fixed eight-dimension order", () => {
  const dimensions = mapDnaDimensions({
    REFLECTION: 0.8,
    PERCEPTION: 0.4,
  });
  assert.deepEqual(dimensions.map((dimension) => dimension.name), DNA_DIMENSION_ORDER);
  assert.equal(dimensions.length, 8);
});

test("DNA dimensions keep missing values explicit", () => {
  const dimensions = mapDnaDimensions({ PERCEPTION: 0.4 });
  assert.equal(dimensions[0].value, 0.4);
  assert.equal(dimensions[1].value, null);
});

test("DnaDimensionsCard clamps out-of-range values", () => {
  const markup = renderToStaticMarkup(
    React.createElement(DnaDimensionsCard, {
      dimensions: [
        { name: "PERCEPTION", value: 4 },
        { name: "DECISION", value: -2 },
      ],
    }),
  );
  assert.match(markup, /aria-valuenow="4"/);
  assert.match(markup, /aria-valuenow="0"/);
});

test("LifecycleCard does not invent a failure rate", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LifecycleCard, {
      lifecycle: { phase: "Seed", health: "Healthy" },
    }),
  );
  assert.match(markup, /Failure Rate/);
  assert.match(markup, />--</);
});

test("inactive Cells map to idle activity", () => {
  assert.equal(mapCellActivity({ id: "B01", active: false, status: "idle" }), "idle");
});

test("active seed Cells map to growing activity", () => {
  const visual = mapCellToVisualState({
    id: "B01",
    active: true,
    status: "active",
    lifecycle: { phase: "Seed" },
    maturity: 0.25,
  });
  assert.equal(visual.activity, "growing");
  assert.equal(visual.maturityPercentage, 25);
});

test("Activate uses the Cell cultivation endpoint instead of heartbeat", async () => {
  await assertCellActionRequest(activateCell, "/api/v1/cells/B01/activate");
});

test("Deactivate uses the Cell cultivation endpoint instead of heartbeat", async () => {
  await assertCellActionRequest(deactivateCell, "/api/v1/cells/B01/deactivate");
});

test("Cultivate Run One Cycle uses the existing heartbeat cycle endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ status: "completed" });
  };

  try {
    await startCultivation();
    assert.equal(request.url, "/api/v1/heartbeat/runs");
    assert.equal(request.options.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stabilize posts to the selected Cell endpoint", async () => {
  await assertJsonRequest({
    action: () => stabilizeCell("B01"),
    path: "/api/v1/cells/B01/stabilize",
    body: undefined,
  });
});

test("Divide posts the selected parent and child ID", async () => {
  await assertJsonRequest({
    action: () => divideCell("B01", { childCellId: "cell-005" }),
    path: "/api/v1/cells/B01/divide",
    body: { childCellId: "cell-005" },
  });
});

test("Fuse preserves selected Cell as the first parent", async () => {
  await assertJsonRequest({
    action: () => fuseCells({
      parentCellIds: ["B01", "cell-001", "cell-002"],
      childCellId: "cell-005",
    }),
    path: "/api/v1/cells/fuse",
    body: {
      parentCellIds: ["B01", "cell-001", "cell-002"],
      childCellId: "cell-005",
    },
  });
});

test("Cell operations report an unavailable backend with readable text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  try {
    await assert.rejects(
      stabilizeCell("B01"),
      /Backend unavailable/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CellControlCard disables Activate for an active Cell", () => {
  const markup = renderControlCard({ active: true, status: "active" });
  assert.match(markup, /<button type="button" disabled="">Activate<\/button>/);
});

test("CellControlCard disables Deactivate for an idle Cell", () => {
  const markup = renderControlCard({ active: false, status: "idle" });
  assert.match(markup, /<button type="button" disabled="">Deactivate<\/button>/);
});

function renderDish(cells, overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(IncubatorDish, {
      dishRef: null,
      cells,
      selectedCellId: cells[0]?.id ?? null,
      isLoading: false,
      error: null,
      isMotionPaused: false,
      isFocusActive: false,
      onSelectCell: () => {},
      onRetry: () => {},
      onCreateCell: () => {},
      ...overrides,
    }),
  );
}

function renderWorkspace(cells, overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(IncubatorWorkspace, {
      cells,
      selectedCellId: cells[0]?.id ?? null,
      isLoading: false,
      error: null,
      isVisualMotionPaused: false,
      isCultivating: false,
      summary: getIncubatorSummary(cells),
      aiSettings: {
        current: {
          provider: "copilot",
          model: "gpt-5-mini",
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
          {
            id: "gemini",
            label: "Gemini",
            models: ["auto", "gemini-2.5-pro", "gemini-2.5-flash"],
          },
        ],
      },
      dockMessage: "",
      dockError: "",
      onSelectCell: () => {},
      onRunOneCycle: () => {},
      onToggleVisualMotion: () => {},
      onChangeAiSettings: () => {},
      onRetry: () => {},
      onCreateCell: () => {},
      activeCellOperation: null,
      isFuseMenuOpen: false,
      selectedFuseCellIds: [],
      onOpenStabilize: () => {},
      onOpenDivide: () => {},
      onToggleFuseMenu: () => {},
      onToggleFuseCell: () => {},
      onCancelFuse: () => {},
      onContinueFuse: () => {},
      onCloseFuseMenu: () => {},
      ...overrides,
    }),
  );
}

function renderOperationDialog(dialog) {
  return renderToStaticMarkup(
    React.createElement(CellOperationDialogs, {
      dialog,
      selectedCellId: "B01",
      selectedFuseCellIds: ["cell-001", "cell-002"],
      childCellId: "cell-003",
      activeOperation: null,
      error: "",
      onChangeChildCellId: () => {},
      onClose: () => {},
      onBackToFuseSelection: () => {},
      onConfirmStabilize: () => {},
      onConfirmDivide: () => {},
      onConfirmFuse: () => {},
    }),
  );
}

function createCells(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `B${String(index + 1).padStart(2, "0")}`,
    name: `B${String(index + 1).padStart(2, "0")}`,
    status: index === 0 ? "active" : "idle",
    active: index === 0,
    maturity: index / 10,
  }));
}

function renderControlCard(cellState) {
  return renderToStaticMarkup(
    React.createElement(CellControlCard, {
      cell: { id: "B01", name: "B01", ...cellState },
      visual: {
        id: "B01",
        name: "B01",
        activityLabel: cellState.active ? "Healthy" : "Idle",
        palette: { primary: "74, 210, 232" },
      },
      activeAction: null,
      message: null,
      error: null,
      onActivate: () => {},
      onDeactivate: () => {},
    }),
  );
}

async function assertCellActionRequest(action, expectedPath) {
  const originalFetch = globalThis.fetch;
  let request = null;

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 204 });
  };

  try {
    await action("B01");
    assert.equal(request.url, expectedPath);
    assert.equal(request.options.method, "POST");
    assert.doesNotMatch(request.url, /heartbeat/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertJsonRequest({ action, path, body }) {
  const originalFetch = globalThis.fetch;
  let request = null;

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ status: "completed", complete: true });
  };

  try {
    await action();
    assert.equal(request.url, path);
    assert.equal(request.options.method, "POST");

    if (body === undefined) {
      assert.equal(request.options.body, undefined);
    } else {
      assert.deepEqual(JSON.parse(request.options.body), body);
      assert.equal(
        request.options.headers["content-type"],
        "application/json",
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}
