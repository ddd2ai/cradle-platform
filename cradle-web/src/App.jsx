import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  fetchCell,
  fetchCellDna,
  fetchCellMaturity,
  fetchCellWorkspace,
  fetchCells,
} from "./api/cradleClient";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { WelcomePanel } from "./components/WelcomePanel";
import { CellPanel } from "./components/CellPanel";

function App() {
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [cells, setCells] = useState([]);
  const [isLoadingCells, setIsLoadingCells] = useState(true);
  const [cellsError, setCellsError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isLoadingCell, setIsLoadingCell] = useState(false);
  const [cellError, setCellError] = useState(null);
  const detailRequestRef = useRef(0);

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
  async function handleSelectCell(cellId) {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    setSelectedCellId(cellId);
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
        setSelectedCell({
          ...cell,
          dna,
          workspace,
          maturity: maturity.maturity,
        });
      }
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        setCellError(error.message);
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setIsLoadingCell(false);
      }
    }
  }

  function handleCreateCell() {
    console.log("Create new cell");
  }

  return (
    <div className="app-shell">
      <Sidebar
        cells={cells}
        selectedCellId={selectedCellId}
        onSelectCell={handleSelectCell}
        onCreateCell={handleCreateCell}
        isLoading={isLoadingCells}
        error={cellsError}
      />
      <div className="main-layout">
        <Header
          selectedCell={selectedCell}
          isServerConnected={!isLoadingCells && !cellsError}
        />
        <main className="main-content">
          {!selectedCellId && (
            <WelcomePanel onCreateCell={handleCreateCell} />
          )}
          {selectedCellId && isLoadingCell && (
            <div className="content-message">Loading cell...</div>
          )}
          {selectedCellId && !isLoadingCell && cellError && (
            <div className="content-message error">
              Unable to load cell details
            </div>
          )}
          {selectedCellId && !isLoadingCell && !cellError && selectedCell && (
            <CellPanel cell={selectedCell} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
