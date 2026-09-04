import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  activateCell,
  deactivateCell,
  divideCell,
  fetchArtifactTypes,
  feedCell,
  fuseCells,
  stabilizeCell,
  startCultivation,
  uploadStimulusFile,
} from "../src/api/cradleClient.js";
import { DNA_DIMENSION_ORDER, mapDnaDimensions } from "../src/components/cell/dna-dimensions.js";
import { CELL_PALETTES } from "../src/constants/incubatorVisuals.js";

let vite;
let IncubatorDish;
let IncubatorWorkspace;
let hasFilePayload;
let CultivationProgressCard;
let CultivationActivityStack;
let formatElapsed;
let DigitalMicroscopeControls;
let CellOperationDialogs;
let CellControlCard;
let CellInspectorDrawer;
let Sidebar;
let SettingsPage;
let CreationsPage;
let LifecycleCard;
let MaturityCard;
let DnaDimensionsCard;
let getIncubatorSummary;
let mapCellActivity;
let mapCellToVisualState;
let normalizePercentage;
let formatStabilizeMessage;
let mapCreationDtoToCreation;
let getArtifactDownloadUrl;
let projectCellToViewport;
let buildObservatoryModel;

// operation-progress.js 必須透過 vite SSR 載入,才能與 CellOperationDialogs 共用同一個 store 實例
let updateOperationProgress;
let clearAllOperationStates;
let flushAllPendingProgress;

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
  ({ hasFilePayload } = await vite.ssrLoadModule(
    "/src/hooks/useIncubatorFeed.js",
  ));
  ({ CultivationProgressCard } = await vite.ssrLoadModule(
    "/src/components/incubator/CultivationProgressCard.jsx",
  ));
  ({ formatElapsed } = await vite.ssrLoadModule(
    "/src/domain/cultivationElapsed.js",
  ));
  ({ CultivationActivityStack } = await vite.ssrLoadModule(
    "/src/components/incubator/CultivationActivityStack.jsx",
  ));
  ({ DigitalMicroscopeControls } = await vite.ssrLoadModule(
    "/src/components/incubator/DigitalMicroscopeControls.jsx",
  ));
  ({ CellOperationDialogs } = await vite.ssrLoadModule(
    "/src/components/incubator/CellOperationDialogs.jsx",
  ));
  ({ CellControlCard } = await vite.ssrLoadModule(
    "/src/components/incubator/CellControlCard.jsx",
  ));
  ({ CellInspectorDrawer } = await vite.ssrLoadModule(
    "/src/components/incubator/CellInspectorDrawer.jsx",
  ));
  ({ Sidebar } = await vite.ssrLoadModule(
    "/src/components/Sidebar.jsx",
  ));
  ({ SettingsPage } = await vite.ssrLoadModule(
    "/src/pages/SettingsPage.jsx",
  ));
  ({ CreationsPage } = await vite.ssrLoadModule(
    "/src/pages/CreationsPage.jsx",
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
  ({ mapCreationDtoToCreation, getArtifactDownloadUrl } = await vite.ssrLoadModule(
    "/src/features/creations/api.ts",
  ));
  ({ projectCellToViewport } = await vite.ssrLoadModule(
    "/src/features/incubator/utils/projectCellToViewport.js",
  ));
  ({ buildObservatoryModel } = await vite.ssrLoadModule(
    "/src/domain/observatoryModel.js",
  ));

  // 透過 vite SSR 載入 operation-progress,確保與 CellOperationDialogs 共用同一個模組實例
  ({
    updateOperationProgress,
    clearAllOperationStates,
    flushAllPendingProgress,
  } = await vite.ssrLoadModule("/src/services/operation-progress.js"));
});

after(async () => {
  await vite?.close();
});

test("IncubatorDish renders one selectable organism per visible Cell", () => {
  const markup = renderDish(createCells(5));
  assert.equal((markup.match(/data-cell-id=/g) ?? []).length, 5);
});

test("projectCellToViewport makes closer Cells larger and higher in stacking", () => {
  const camera = { yaw: 0, pitch: 0, distance: 900 };
  const near = projectCellToViewport({
    position: { x: 0, y: 0, z: -220 },
    camera,
    viewportWidth: 900,
    viewportHeight: 560,
  });
  const far = projectCellToViewport({
    position: { x: 0, y: 0, z: 220 },
    camera,
    viewportWidth: 900,
    viewportHeight: 560,
  });

  assert.ok(near.scale > far.scale);
  assert.ok(near.opacity >= far.opacity);
  assert.ok(near.zIndex > far.zIndex);
});

test("projectCellToViewport can shift the observation center away from the drawer", () => {
  const projection = projectCellToViewport({
    position: { x: 0, y: 0, z: 0 },
    camera: { yaw: 0, pitch: 0, distance: 900 },
    viewportWidth: 520,
    viewportHeight: 560,
    centerX: 260,
  });

  assert.equal(projection.screenX, 260);
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
    "Foundation",
    "Incubator",
    "Observatory",
    "Creations",
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

test("Observatory separates recorded attention from insufficient evidence", () => {
  const model = buildObservatoryModel([
    {
      cellId: "stable-cell",
      name: "Stable Cell",
      cultivation: { state: "stable" },
      maturity: { percent: 72, sampleSize: 4 },
      dna: { maturityTrend: [] },
    },
    {
      cellId: "unknown-cell",
      name: "Unknown Cell",
      cultivation: { state: "idle" },
      maturity: { percent: 0, sampleSize: 1 },
      dna: { maturityTrend: [] },
    },
    {
      cellId: "attention-cell",
      name: "Attention Cell",
      cultivation: { state: "needs_attention", attention: { message: "Quality gate failed" } },
      maturity: { percent: 41, sampleSize: 3 },
      dna: { maturityTrend: [] },
    },
  ]);

  assert.equal(model.stableCount, 1);
  assert.equal(model.attentionCount, 1);
  assert.equal(model.insufficientCount, 1);
  assert.equal(model.attention.length, 2);
  assert.equal(model.cells[1].maturityPercent, null);
  assert.match(model.attention[1].reason, /Quality gate failed/);
});

test("SettingsPage renders the mock Runtime settings", () => {
  const markup = renderToStaticMarkup(React.createElement(SettingsPage));

  for (const label of [
    "Runtime",
    "Providers",
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

test("IncubatorDish renders every Cell in the primary field", () => {
  const markup = renderDish(createCells(13));
  assert.equal((markup.match(/data-cell-id=/g) ?? []).length, 13);
  assert.doesNotMatch(markup, /incubator-overflow-count/);
  assert.match(markup, /data-cell-id="B13"/);
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
  assert.match(markup, /left:450px/);
  assert.match(markup, /top:280px/);
  assert.match(markup, /--cell-projection-scale:1/);
  assert.match(markup, /--drift-duration:/);
  assert.match(markup, /--breathe-duration:/);
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
  assert.match(markup, /incubator-dish__field/);
  assert.match(markup, /Unable to load cells/);
});

test("Incubator workspace renders only incubator controls in the bottom dock", () => {
  const markup = renderWorkspace([
    { id: "B01", status: "active", maturity: 10 },
    { id: "B02", status: "idle", maturity: 40 },
    { id: "B03", status: "running", maturity: "not available" },
  ]);

  for (const label of ["Cultivate"]) {
    assert.match(markup, new RegExp(`>${label}<`));
  }

  assert.match(markup, /Feed Cradle\. It will find the right Cell\.\.\./);
  assert.match(markup, /aria-label="Cultivate text stimulus"/);
  assert.match(markup, /data-feed-scope="cradle-auto-route"/);
  assert.match(markup, /Release and let Cradle determine where this material belongs/);
  assert.doesNotMatch(markup, />Feed</);
  assert.doesNotMatch(markup, />Microscope</);
  assert.doesNotMatch(markup, />Run One Cycle</);
  assert.match(markup, /aria-label="Orbit left"/);
  assert.match(markup, /aria-label="Move camera forward"/);
  assert.doesNotMatch(markup, />Command</);
  assert.doesNotMatch(markup, />Stabilize</);
  assert.doesNotMatch(markup, />Divide</);
  assert.doesNotMatch(markup, />Fuse</);
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
  assert.doesNotMatch(markup, />Creations</);
  assert.doesNotMatch(markup, />Logs</);
  assert.doesNotMatch(markup, />Environment<\/dt>/);
  assert.doesNotMatch(markup, />Alerts<\/dt>/);
  assert.doesNotMatch(markup, />Total Runtime<\/dt>/);
  assert.doesNotMatch(markup, /98%|12h 34m/);
  assert.doesNotMatch(markup, /Java 21/);
  assert.doesNotMatch(markup, /Spring Boot 3/);
  assert.doesNotMatch(markup, /Hexagonal/);
});

test("DigitalMicroscopeControls renders d-pad, magnification, and reset controls", () => {
  const markup = renderToStaticMarkup(
    React.createElement(DigitalMicroscopeControls, {
      camera: { yaw: 0, pitch: 0, distance: 900 },
      hasSelectedCell: true,
      onOrbitLeft: () => {},
      onMoveForward: () => {},
      onMoveBackward: () => {},
      onOrbitRight: () => {},
      onFocusSelected: () => {},
      onReset: () => {},
    }),
  );

  for (const label of [
    "Digital microscope navigation",
    "Orbit left",
    "Move camera forward",
    "Move camera backward",
    "Orbit right",
    "Focus selected cell",
    "Reset microscope camera",
    "100%",
    "Reset",
  ]) {
    assert.match(markup, new RegExp(label));
  }

  assert.doesNotMatch(markup, /Colony overview/);
  assert.match(markup, /<\/div><button[^>]+class="microscope-controls__focus"/);
});

test("Microscope focus is outside the d-pad and disabled without a selected Cell", () => {
  const markup = renderWorkspace(createCells(1), { selectedCellId: null });
  assert.doesNotMatch(markup, /microscope-controls__dpad-button--focus/);
  assert.match(markup, /class="microscope-controls__focus" disabled="" aria-label="Focus selected cell" title="Focus selected cell">◎<\/button>/);
});

test("Incubator feed stays auto-routed with or without a selected Cell", () => {
  const markup = renderWorkspace(createCells(1), { selectedCellId: null });
  assert.match(markup, /Feed Cradle\. It will find the right Cell\.\.\./);
  assert.match(markup, /aria-label="Attach feeding material"/);
  assert.match(markup, /aria-label="Cultivate text stimulus"/);
});

test("Incubator-wide drop scope recognizes any dragged file payload", () => {
  assert.equal(hasFilePayload({ types: ["Files"] }), true);
  assert.equal(hasFilePayload({ types: ["text/plain"] }), false);
  assert.equal(hasFilePayload(null), false);
});

test("Control dock reserves space when the inspector drawer is open", () => {
  const markup = renderWorkspace(createCells(2), { selectedCellId: "B01" });
  assert.match(markup, /cradle-control-dock__viewport--inspector-open/);
});

test("CellInspectorDrawer stays collapsed without a selected Cell", () => {
  const markup = renderInspectorDrawer({
    cell: null,
    visual: null,
    isOpen: false,
  });

  assert.match(markup, /cell-inspector-drawer--closed/);
  assert.doesNotMatch(markup, /No Cell selected/);
  assert.doesNotMatch(markup, />Stabilize</);
});

test("CellInspectorDrawer renders selected Cell details and contextual actions", () => {
  const markup = renderInspectorDrawer();

  for (const label of [
    "cell-inspector-drawer--open",
    "Selected cell inspector",
    "B01",
    "Active",
    "Close cell inspector",
    "Cell operations",
    "Activate",
    "Deactivate",
    "Lifecycle",
    "Maturity",
    "DNA Profile",
    "Stabilize",
    "Divide",
    "Fuse",
  ]) {
    assert.match(markup, new RegExp(label));
  }
});

test("Creation adapter maps API DTOs into Creation view models", () => {
  assert.deepEqual(
    mapCreationDtoToCreation({
      id: "artifact-001",
      artifactId: "artifact-001",
      title: "Option Pricing API",
      originCellId: "cell-001",
      type: "code",
      status: "draft",
      stage: "seed",
      description: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
      planSummary: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
      summary: "This generic summary should not drive the card.",
      goal: "Create an option pricing system.",
      provider: "codex",
      model: "gpt-5.6-sol",
      languages: ["java", "xml"],
      previewImageUrl: "/api/v1/creations/artifact-001/preview",
      workspaceAvailable: true,
      updatedAt: "2026-07-28T12:00:00Z",
    }),
    {
      id: "artifact-001",
      artifactId: "artifact-001",
      title: "Option Pricing API",
      originCellId: "cell-001",
      type: "code",
      stage: "seed",
      status: "idle",
      description: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
      planSummary: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
      summary: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
      goal: "Create an option pricing system.",
      provider: "codex",
      model: "gpt-5.6-sol",
      tags: ["code", "java", "xml"],
      previewImageUrl: "/api/v1/creations/artifact-001/preview",
      previewUrl: undefined,
      workspaceAvailable: true,
      createdAt: undefined,
      updatedAt: "2026-07-28T12:00:00Z",
    },
  );
});

test("Creation artifact download URL targets the artifact export endpoint", () => {
  assert.equal(
    getArtifactDownloadUrl({
      artifactId: "artifact-001",
      originCellId: "cell-001",
    }),
    "/api/v1/cells/cell-001/artifacts/artifact-001/export",
  );
});

test("CreationsPage renders API-driven creation cards", () => {
  const markup = renderToStaticMarkup(
    React.createElement(CreationsPage, {
      skipInitialLoad: true,
      onOpenWorkspace: () => {},
      initialCreations: [
        {
          id: "artifact-001",
          artifactId: "artifact-001",
          title: "Option Pricing API",
          originCellId: "cell-001",
          type: "code",
          stage: "seed",
          status: "healthy",
          description: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
          planSummary: "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
          summary: "This generic summary should not render.",
          goal: "Create an option pricing system.",
          provider: "codex",
          model: "gpt-5.6-sol",
          tags: ["code", "java"],
          previewImageUrl: "/api/v1/creations/artifact-001/preview",
          previewUrl: undefined,
          workspaceAvailable: true,
        },
      ],
    }),
  );

  for (const label of [
    "Search...",
    "Option Pricing API preview",
    "Option Pricing API",
    "以 Java 21、Spring Boot 與六角形架構建立選擇權評價 API，第一版支援歐式買權與賣權的 Black-Scholes 評價及 Greeks 計算。",
    "Created by",
    "cell-001",
    "artifact-001",
    "codex / gpt-5.6-sol",
    "Healthy",
    "code",
    "java",
    "Artifact",
    "Show Cell",
  ]) {
    assert.match(markup, new RegExp(label));
  }

  assert.doesNotMatch(markup, /REST API Starter/);
  assert.doesNotMatch(markup, /This generic summary should not render/);
  assert.doesNotMatch(markup, /Create an option pricing system/);
});

test("CellInspectorDrawer disables Fuse when no candidate Cell exists", () => {
  const markup = renderInspectorDrawer({ fuseCandidates: [] });
  assert.match(markup, /<button type="button" disabled="" aria-label="Fuse B01">[\s\S]*?Fuse<\/button>/);
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

test("Divide dialog renders live operation stage and progress", () => {
  // Phase 4: CellOperationDialogs 改為透過 operationId + useOperationProgress hook 取得 progress。
  // renderToStaticMarkup 不執行 useEffect,但會執行 useState initializer,
  // 所以先把 operation 放進 store,useOperationProgress 的 useState(() => getOperationState(id)) 即可讀到。
  const operationId = "test-op-divide-progress";
  updateOperationProgress({
    operationId,
    status: "running",
    progress: 25,
    currentStage: "planning-living-context",
  });
  flushAllPendingProgress();

  const markup = renderOperationDialog("divide", {
    activeOperation: "divide",
    operationId,
  });

  clearAllOperationStates();

  assert.match(markup, /Planning Living Context/);
  assert.match(markup, /25%/);
  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-valuenow="25"/);
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

test("Cell inspector details keep operations inside the drawer operation row", () => {
  const cell = { id: "B01", name: "B01", status: "active", maturity: 0.25 };
  const visual = mapCellToVisualState(cell);
  const markup = renderToStaticMarkup(
    React.createElement(CellInspectorDrawer, {
      cell,
      visual,
      isOpen: true,
      isLoading: false,
      error: null,
      activeAction: null,
      actionMessage: null,
      actionError: null,
      activeOperation: null,
      operationError: "",
      fuseCandidates: createCells(2).slice(1),
      selectedFuseCellIds: [],
      onActivate: () => {},
      onDeactivate: () => {},
      onClose: () => {},
      onStabilize: () => {},
      onDivide: () => {},
      onOpenFuseSelection: () => {},
      onToggleFuseCell: () => {},
      onCancelFuse: () => {},
      onContinueFuse: () => {},
    }),
  );

  assert.doesNotMatch(markup, /cell-action-bar/);
  assert.match(markup, /cell-inspector-drawer__actions/);
  assert.match(markup, /aria-label="Cell operations"/);
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

  assert.match(markup, /DNA Profile/);
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

test("Divide waits for an accepted operation and returns its business result", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const progress = [];

  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === "/api/v1/cells/B01/divide") {
      return Response.json({
        operationId: "op-divide",
        type: "cell-division",
        status: "accepted",
        progress: 0,
        currentStage: "accepted",
      }, { status: 202 });
    }

    return Response.json({
      operation: {
        operationId: "op-divide",
        type: "cell-division",
        status: "completed",
        progress: 100,
        currentStage: "completed",
        result: { childCellId: "cell-005", complete: true },
      },
    });
  };

  try {
    const result = await divideCell(
      "B01",
      { childCellId: "cell-005" },
      { onProgress: (operation) => progress.push(operation.currentStage) },
    );

    assert.deepEqual(result, { childCellId: "cell-005", complete: true });
    assert.deepEqual(requests.map((request) => request.url), [
      "/api/v1/cells/B01/divide",
      "/api/v1/operations/op-divide",
    ]);
    assert.deepEqual(progress, ["accepted", "completed"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("Feed posts content to the selected Cell inbox endpoint", async () => {
  await assertJsonRequest({
    action: () => feedCell("B01", { content: "Study error handling." }),
    path: "/api/v1/cells/B01/feed",
    body: { content: "Study error handling." },
  });
});

test("File stimulus upload returns the accepted background operation", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({
      operationId: "op-stimulus",
      type: "stimulus-cultivation",
      status: "accepted",
      progress: 0,
      currentStage: "accepted",
      lifeState: "growing",
    }, { status: 202 });
  };

  try {
    const file = new Blob(["bounded evidence"], { type: "text/plain" });
    Object.defineProperty(file, "name", { value: "quality notes.txt" });
    const accepted = await uploadStimulusFile(file, { artifactType: "spec" });
    assert.equal(accepted.operationId, "op-stimulus");
    assert.equal(request.url, "/api/v1/stimuli/files");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["content-type"], "text/plain");
    assert.equal(request.options.headers["x-cradle-file-name"], "quality%20notes.txt");
    assert.equal(request.options.headers["x-cradle-artifact-type"], "spec");
    assert.equal(request.options.body, file);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Artifact capabilities come from the server catalog", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    items: [{ id: "code", label: "Code" }, { id: "image", label: "Image" }],
    selectionAuthority: "explicit",
  });
  try {
    assert.deepEqual(await fetchArtifactTypes(), [
      { id: "code", label: "Code" },
      { id: "image", label: "Image" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cultivation progress shows real phase and elapsed time while work is growing", () => {
  const growing = renderToStaticMarkup(React.createElement(CultivationProgressCard, {
    operationId: null,
    acceptedOperation: {
      operationId: "op-growing",
      status: "running",
      progress: 58,
      currentStage: "cultivating",
      lifeState: "growing",
      context: { cellIds: ["B01"], sourceName: "notes.md" },
    },
    selectedCell: { id: "B01", name: "B01" },
  }));
  assert.match(growing, /role="progressbar"/);
  assert.match(growing, /Cultivating · .* elapsed/);
  assert.match(growing, /aria-valuetext="Cultivating · .* elapsed"/);
  assert.doesNotMatch(growing, />58% ·/);

  const produced = renderToStaticMarkup(React.createElement(CultivationProgressCard, {
    operationId: null,
    acceptedOperation: {
      operationId: "op-produced",
      status: "completed",
      progress: 100,
      currentStage: "stable",
      lifeState: "stable",
      context: { cellIds: ["B01"], sourceName: "api.md" },
      artifacts: [{ artifactId: "artifact-spec", decision: "created" }],
    },
    selectedCell: { id: "B01", name: "B01" },
  }));
  assert.match(produced, /Artifact artifact-spec was born/);

  const attention = renderToStaticMarkup(React.createElement(CultivationProgressCard, {
    operationId: null,
    acceptedOperation: {
      operationId: "op-attention",
      status: "completed",
      progress: 100,
      currentStage: "needs_attention",
      lifeState: "needs_attention",
      context: { cellIds: ["B01"], sourceName: "scan.pdf" },
    },
    selectedCell: {
      id: "B01",
      name: "B01",
      cultivation: { attention: { message: "OCR unavailable" } },
    },
  }));
  assert.doesNotMatch(attention, /role="progressbar"/);
  assert.match(attention, /Needs Attention/);
  assert.match(attention, /needs text extraction or OCR/);
});

test("Cultivation activity keeps queued stimuli visible together", () => {
  const markup = renderToStaticMarkup(React.createElement(CultivationActivityStack, {
    items: [
      {
        feedId: "feed-2",
        sourceName: "second.md",
        state: "queued",
        queuePosition: 1,
      },
      {
        feedId: "feed-1",
        sourceName: "first.md",
        state: "uploading",
      },
    ],
  }));

  assert.match(markup, /Cultivation activity/);
  assert.match(markup, /second.md/);
  assert.match(markup, /Queue 1/);
  assert.match(markup, /first.md/);
  assert.match(markup, /Entering Cradle/);
});

test("elapsed cultivation time is derived from operation timestamps", () => {
  assert.equal(
    formatElapsed("2026-09-04T00:00:00.000Z", "2026-09-04T00:01:05.000Z"),
    "1m 5s",
  );
});

test("Cell cultivation state takes precedence over manual active state", () => {
  assert.equal(mapCellActivity({
    id: "B01",
    active: false,
    status: "idle",
    cultivation: { state: "growing", progress: 58 },
  }), "growing");
  assert.equal(mapCellActivity({
    id: "B01",
    active: true,
    status: "active",
    cultivation: { state: "needs_attention", progress: 100 },
  }), "needs-attention");
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
      projectedCells: createProjectedCells(cells),
      selectedCellId: cells[0]?.id ?? null,
      isLoading: false,
      error: null,
      isMotionPaused: false,
      onSelectCell: () => {},
      onFocusCell: () => {},
      onRetry: () => {},
      onCreateCell: () => {},
      ...overrides,
    }),
  );
}

function createProjectedCells(cells) {
  return cells.map((cell, index) => ({
    cell,
    projection: {
      screenX: 450 + index * 12,
      screenY: 280 + index * 4,
      scale: 1 - index * 0.02,
      opacity: 1 - index * 0.01,
      depth: -index,
      zIndex: 1000 - index,
    },
    size: index === 0 ? 154 : 92,
    primary: index === 0,
  }));
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
      onClearSelectedCell: () => {},
      onRunOneCycle: () => {},
      onRetry: () => {},
      onCreateCell: () => {},
      activeCellOperation: null,
      selectedFuseCellIds: [],
      onOpenStabilize: () => {},
      onOpenDivide: () => {},
      onOpenFuseSelection: () => {},
      onToggleFuseCell: () => {},
      onCancelFuse: () => {},
      onContinueFuse: () => {},
      ...overrides,
    }),
  );
}

function renderInspectorDrawer(overrides = {}) {
  const cell = { id: "B01", name: "B01", status: "active", active: true, maturity: 0.25 };
  const visual = mapCellToVisualState(cell);

  return renderToStaticMarkup(
    React.createElement(CellInspectorDrawer, {
      cell,
      visual,
      isOpen: true,
      isLoading: false,
      error: null,
      activeAction: null,
      actionMessage: null,
      actionError: null,
      activeOperation: null,
      operationError: "",
      fuseCandidates: [
        { id: "B02", name: "B02", status: "idle" },
        { id: "B03", name: "B03", status: "running" },
      ],
      selectedFuseCellIds: [],
      onActivate: () => {},
      onDeactivate: () => {},
      onClose: () => {},
      onStabilize: () => {},
      onDivide: () => {},
      onOpenFuseSelection: () => {},
      onToggleFuseCell: () => {},
      onCancelFuse: () => {},
      onContinueFuse: () => {},
      ...overrides,
    }),
  );
}

function renderOperationDialog(dialog, overrides = {}) {
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
      ...overrides,
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
