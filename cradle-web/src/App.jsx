import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  activateAllCells,
  activateCell,
  createCell,
  deactivateAllCells,
  deactivateCell,
  fetchCell,
  fetchCellDna,
  fetchCellLifecycleDecision,
  fetchCellMaturity,
  fetchCellWorkspace,
  fetchCells,
  fetchCultivationStatus,
  startCultivation,
  stopCultivation,
} from "./api/cradleClient";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { CellPanel } from "./components/CellPanel";
import { CradleOverviewPage } from "./pages/CradleOverviewPage";
import { CultivationPage } from "./pages/CultivationPage";
import { IncubatorPage } from "./pages/IncubatorPage";
import { LogsPage } from "./pages/LogsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

function App() {
  const [selectedSection, setSelectedSection] = useState("incubator");
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [cells, setCells] = useState([]);
  const [isLoadingCells, setIsLoadingCells] = useState(true);
  const [cellsError, setCellsError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isLoadingCell, setIsLoadingCell] = useState(false);
  const [cellError, setCellError] = useState(null);
  const [cellAction, setCellAction] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isCreateCellOpen, setIsCreateCellOpen] = useState(false);
  const [newCellId, setNewCellId] = useState("");
  const [isCreatingCell, setIsCreatingCell] = useState(false);
  const [createCellError, setCreateCellError] = useState(null);
  const [heartbeatRun, setHeartbeatRun] = useState(null);
  const [heartbeatStatus, setHeartbeatStatus] = useState(null);
  const [heartbeatMessage, setHeartbeatMessage] = useState(null);
  const [heartbeatError, setHeartbeatError] = useState(null);
  const [cultivationStatus, setCultivationStatus] = useState({
    status: "dormant",
    activeCells: 0,
    activeTicks: 0,
    runningTasks: 0,
    activeTickCellIds: [],
    startedAt: null,
    stoppingAt: null,
  });
  const detailRequestRef = useRef(0);
  const selectedCellIdRef = useRef(null);
  const activeCellCount = cells.filter((cell) => cell.active === true).length;

  async function loadCells() {
    try {
      setIsLoadingCells(true);
      setCellsError(null);
      const loadedCells = await fetchCells();
      setCells(loadedCells);
      return loadedCells;
    } catch (error) {
      setCellsError(error.message);
      throw error;
    } finally {
      setIsLoadingCells(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialCells() {
      try {
        setIsLoadingCells(true);
        setCellsError(null);
        const loadedCells = await fetchCells();

        if (!cancelled) {
          setCells(loadedCells);
        }
      } catch (error) {
        if (!cancelled) {
          setCellsError(error.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCells(false);
        }
      }
    }

    loadInitialCells();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCultivationStatus() {
      try {
        const status = await fetchCultivationStatus();

        if (!cancelled) {
          setCultivationStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          setHeartbeatError(error.message);
        }
      }
    }

    loadCultivationStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cultivationStatus.status !== "stopping") {
      return undefined;
    }

    const timerId = window.setInterval(async () => {
      try {
        const status = await fetchCultivationStatus();
        setCultivationStatus(status);
      } catch (error) {
        setHeartbeatError(error.message);
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [cultivationStatus.status]);

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timerId = window.setTimeout(() => setActionMessage(null), 3000);
    return () => window.clearTimeout(timerId);
  }, [actionMessage]);

  useEffect(() => {
    if (!heartbeatMessage) return undefined;

    const timerId = window.setTimeout(() => setHeartbeatMessage(null), 3000);
    return () => window.clearTimeout(timerId);
  }, [heartbeatMessage]);

  async function loadSelectedCell(cellId) {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    setSelectedCell(null);
    setCellError(null);
    setIsLoadingCell(true);

    try {
      const [cell, dna, workspace, maturity, lifecycleDecision] = await Promise.all([
        fetchCell(cellId),
        fetchCellDna(cellId),
        fetchCellWorkspace(cellId),
        fetchCellMaturity(cellId),
        fetchCellLifecycleDecision(cellId),
      ]);

      if (detailRequestRef.current === requestId) {
        const selectedDetail = {
          ...cell,
          dna,
          workspace,
          maturity: maturity.maturity ?? maturity,
          lifecycleDecision,
        };

        setSelectedCell(selectedDetail);
        setCells((currentCells) =>
          currentCells.map((summary) =>
            summary.id === cellId
              ? {
                  ...summary,
                  name: selectedDetail.name ?? summary.name,
                  status: selectedDetail.status ?? summary.status,
                  active: selectedDetail.active ?? summary.active,
                }
              : summary,
          ),
        );

        return true;
      }
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        setCellError(error.message);
      }

      return false;
    } finally {
      if (detailRequestRef.current === requestId) {
        setIsLoadingCell(false);
      }
    }

    return false;
  }

  async function handleSelectCell(cellId) {
    selectedCellIdRef.current = cellId;
    setSelectedSection("cell");
    setActionMessage(null);
    setActionError(null);
    setSelectedCellId(cellId);
    await loadSelectedCell(cellId);
  }

  async function runCellAction(actionName, action) {
    const cellId = selectedCellIdRef.current;

    if (!cellId || cellAction) {
      return;
    }

    try {
      setCellAction(actionName);
      setActionMessage(null);
      setActionError(null);

      await action(cellId);

      if (selectedCellIdRef.current === cellId) {
        const refreshed = await loadSelectedCell(cellId);
        if (!refreshed) {
          throw new Error("Action completed, but Cell refresh failed.");
        }
      }

      setActionMessage(
        actionName === "activate"
          ? "Cell activated successfully."
          : actionName === "deactivate"
            ? "Cell deactivated successfully."
            : "Heartbeat completed successfully.",
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setCellAction(null);
    }
  }

  function handleActivateCell() {
    return runCellAction("activate", activateCell);
  }

  function handleDeactivateCell() {
    return runCellAction("deactivate", deactivateCell);
  }

  async function handleStartCultivation() {
    if (["starting", "stopping"].includes(cultivationStatus.status) || ["starting", "running", "pending", "accepted"].includes(heartbeatStatus)) {
      return;
    }

    try {
      setCultivationStatus((current) => ({
        ...current,
        status: "starting",
      }));
      setHeartbeatStatus("starting");
      setHeartbeatMessage(null);
      setHeartbeatError(null);

      const activatedCells = await activateAllCells();
      setCells(activatedCells.cells);
      if (activatedCells.cultivation) {
        setCultivationStatus(activatedCells.cultivation);
      }
      const operation = await startCultivation();
      setHeartbeatRun(operation);
      setHeartbeatStatus(operation.status ?? "completed");
      await loadCells();
      const status = await fetchCultivationStatus();
      setCultivationStatus(status);
      setHeartbeatMessage("Cultivation started successfully.");
    } catch (error) {
      setHeartbeatStatus("failed");
      setHeartbeatError(error.message);
    }
  }

  async function handleStopCultivation() {
    if (["starting", "stopping", "dormant"].includes(cultivationStatus.status)) {
      return;
    }

    try {
      setCultivationStatus((current) => ({
        ...current,
        status: "stopping",
        stoppingAt: current.stoppingAt ?? new Date().toISOString(),
      }));
      setHeartbeatMessage(null);
      setHeartbeatError(null);

      await stopCultivation();
      const deactivatedCells = await deactivateAllCells();
      setCells(deactivatedCells.cells);
      if (deactivatedCells.cultivation) {
        setCultivationStatus(deactivatedCells.cultivation);
      } else {
        const status = await fetchCultivationStatus();
        setCultivationStatus(status);
      }
      setHeartbeatMessage("Cultivation stopped successfully.");
    } catch (error) {
      setHeartbeatError(error.message);
    }
  }

  function handleSelectSection(section) {
    setSelectedSection(section);
    setSelectedCellId(null);
    selectedCellIdRef.current = null;
    setSelectedCell(null);
    setCellError(null);
    setActionMessage(null);
    setActionError(null);
  }

  function handleCreateCell() {
    setNewCellId(getNextCellId(cells));
    setCreateCellError(null);
    setIsCreateCellOpen(true);
  }

  function handleCloseCreateCell() {
    if (isCreatingCell) {
      return;
    }

    setIsCreateCellOpen(false);
    setCreateCellError(null);
  }

  async function handleSubmitCreateCell(event) {
    event.preventDefault();

    const cellId = newCellId.trim();

    if (!cellId || isCreatingCell) {
      return;
    }

    try {
      setIsCreatingCell(true);
      setCreateCellError(null);

      const createdCell = await createCell(cellId);
      const loadedCells = await loadCells();
      const createdCellId = createdCell.id ?? cellId;

      setIsCreateCellOpen(false);
      setNewCellId("");
      setActionMessage(`Cell ${createdCellId} created successfully.`);

      const existsInList = loadedCells.some((cell) => cell.id === createdCellId);
      await handleSelectCell(existsInList ? createdCellId : cellId);
    } catch (error) {
      setCreateCellError(error.message);
    } finally {
      setIsCreatingCell(false);
    }
  }

  return (
    <div className="app-shell is-incubator">
      <Sidebar
        cells={cells}
        selectedCellId={selectedCellId}
        selectedSection={selectedSection}
        onSelectCell={handleSelectCell}
        onSelectSection={handleSelectSection}
        onCreateCell={handleCreateCell}
        isLoading={isLoadingCells}
        error={cellsError}
      />
      <div className="main-layout">
        <Header
          selectedCell={selectedCell}
          selectedSection={selectedSection}
          isServerConnected={!isLoadingCells && !cellsError}
        />
        <main className="main-content">
          {selectedSection === "overview" && (
            <CradleOverviewPage cells={cells} />
          )}

          {selectedSection === "incubator" && (
            <IncubatorPage
              cells={cells}
              isLoading={isLoadingCells}
              error={cellsError}
              onReloadCells={loadCells}
              onCreateCell={handleCreateCell}
            />
          )}

          {selectedSection === "cultivation" && (
            <CultivationPage
              heartbeatRun={heartbeatRun}
              heartbeatStatus={heartbeatStatus}
              heartbeatError={heartbeatError}
              heartbeatMessage={heartbeatMessage}
              activeCellCount={activeCellCount}
              cultivationStatus={cultivationStatus}
              onStartCultivation={handleStartCultivation}
              onStopCultivation={handleStopCultivation}
            />
          )}

          {selectedSection === "opendna" && (
            <PlaceholderPage
              title="OpenDNA"
              description="Observe DNA traits and relationships across the Cradle."
              icon="🧬"
            />
          )}

          {selectedSection === "artifacts" && (
            <PlaceholderPage
              title="Artifacts"
              description="Browse software artifacts produced by Cradle cells."
              icon="◈"
            />
          )}

          {selectedSection === "logs" && (
            <LogsPage />
          )}

          {selectedSection === "cell" && selectedCellId && isLoadingCell && (
            <div className="content-message">Loading cell...</div>
          )}
          {selectedSection === "cell" && selectedCellId && !isLoadingCell && cellError && (
            <div className="content-message error">
              Unable to load cell details
            </div>
          )}
          {selectedSection === "cell" && selectedCell && !isLoadingCell && !cellError && (
            <CellPanel
              cell={selectedCell}
              onActivate={handleActivateCell}
              onDeactivate={handleDeactivateCell}
              activeAction={cellAction}
              actionMessage={actionMessage}
              actionError={actionError}
            />
          )}
        </main>
      </div>
      {isCreateCellOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="create-cell-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-cell-title"
          >
            <form onSubmit={handleSubmitCreateCell}>
              <div className="dialog-header">
                <div>
                  <h2 id="create-cell-title">New Cell</h2>
                  <p>Create a Cell workspace and register it in the colony.</p>
                </div>
                <button
                  type="button"
                  className="dialog-close-button"
                  onClick={handleCloseCreateCell}
                  disabled={isCreatingCell}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <label className="field-label" htmlFor="new-cell-id">
                Cell ID
              </label>
              <input
                id="new-cell-id"
                className="text-input"
                value={newCellId}
                onChange={(event) => setNewCellId(event.target.value)}
                autoFocus
                disabled={isCreatingCell}
                placeholder="cell-003"
              />

              {createCellError && (
                <div className="dialog-error">{createCellError}</div>
              )}

              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCloseCreateCell}
                  disabled={isCreatingCell}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!newCellId.trim() || isCreatingCell}
                >
                  {isCreatingCell ? "Creating..." : "Create Cell"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function getNextCellId(cells) {
  const existingCellIds = new Set(cells.map((cell) => cell.id));
  let nextIndex = 1;

  while (existingCellIds.has(`cell-${String(nextIndex).padStart(3, "0")}`)) {
    nextIndex += 1;
  }

  return `cell-${String(nextIndex).padStart(3, "0")}`;
}

export default App;
