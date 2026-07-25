import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  activateCell,
  deactivateCell,
  fetchCell,
  fetchCellDna,
  fetchCellMaturity,
  fetchCellWorkspace,
  fetchCells,
  startCultivation,
  stopCultivation,
} from "./api/cradleClient";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { CellPanel } from "./components/CellPanel";
import { CradleOverviewPage } from "./pages/CradleOverviewPage";
import { CultivationPage } from "./pages/CultivationPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

function App() {
  const [selectedSection, setSelectedSection] = useState("overview");
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
  const [heartbeatRun, setHeartbeatRun] = useState(null);
  const [heartbeatStatus, setHeartbeatStatus] = useState(null);
  const [heartbeatMessage, setHeartbeatMessage] = useState(null);
  const [heartbeatError, setHeartbeatError] = useState(null);
  const [cultivationRunning, setCultivationRunning] = useState(false);
  const [cultivationAction, setCultivationAction] = useState(null);
  const detailRequestRef = useRef(0);
  const selectedCellIdRef = useRef(null);
  const activeCellCount = cells.filter((cell) => cell.active === true).length;

  useEffect(() => {
    let cancelled = false;

    async function loadCells() {
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

    loadCells();

    return () => {
      cancelled = true;
    };
  }, []);

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
      const [cell, dna, workspace, maturity] = await Promise.all([
        fetchCell(cellId),
        fetchCellDna(cellId),
        fetchCellWorkspace(cellId),
        fetchCellMaturity(cellId),
      ]);

      if (detailRequestRef.current === requestId) {
        const selectedDetail = {
          ...cell,
          dna,
          workspace,
          maturity: maturity.maturity,
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
    if (cultivationAction || ["starting", "running", "pending", "accepted"].includes(heartbeatStatus)) {
      return;
    }

    try {
      setCultivationAction("start");
      setHeartbeatStatus("starting");
      setHeartbeatMessage(null);
      setHeartbeatError(null);

      const operation = await startCultivation();
      setHeartbeatRun(operation);
      setHeartbeatStatus(operation.status ?? "completed");
      setCultivationRunning(true);
      setHeartbeatMessage("Cultivation started successfully.");
    } catch (error) {
      setHeartbeatStatus("failed");
      setHeartbeatError(error.message);
    } finally {
      setCultivationAction(null);
    }
  }

  async function handleStopCultivation() {
    if (cultivationAction) {
      return;
    }

    try {
      setCultivationAction("stop");
      setHeartbeatMessage(null);
      setHeartbeatError(null);

      await stopCultivation();
      setCultivationRunning(false);
      setHeartbeatMessage("Cultivation stopped successfully.");
    } catch (error) {
      setHeartbeatError(error.message);
    } finally {
      setCultivationAction(null);
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
    console.log("Create new cell");
  }

  return (
    <div className="app-shell">
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

          {selectedSection === "cultivation" && (
            <CultivationPage
              heartbeatRun={heartbeatRun}
              heartbeatStatus={heartbeatStatus}
              heartbeatError={heartbeatError}
              heartbeatMessage={heartbeatMessage}
              activeCellCount={activeCellCount}
              cultivationRunning={cultivationRunning}
              cultivationAction={cultivationAction}
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
            <PlaceholderPage
              title="Logs"
              description="Observe runtime activity and platform events."
              icon="≡"
            />
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
    </div>
  );
}

export default App;
