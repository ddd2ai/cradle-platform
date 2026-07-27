import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCell,
  fetchCellDna,
  fetchCellLifecycleDecision,
  fetchCellMaturity,
  fetchCellWorkspace,
  fetchAiSettings,
  divideCell,
  fuseCells,
  stabilizeCell,
  startCultivation,
  updateAiSettings,
} from "../api/cradleClient";
import { CellOperationDialogs } from "../components/incubator/CellOperationDialogs";
import { IncubatorWorkspace } from "../components/incubator/IncubatorWorkspace";
import { SelectedCellPanel } from "../components/incubator/SelectedCellPanel";
import { mapCellToVisualState } from "../domain/cellVisualMapper";
import { getIncubatorSummary } from "../domain/incubatorSummary";
import { formatStabilizeMessage } from "../domain/stabilizationResult";
import { useCellCultivationActions } from "../hooks/useCellCultivationActions";

export function IncubatorPage({
  cells,
  isLoading,
  error,
  onReloadCells,
  onCreateCell,
}) {
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isLoadingCell, setIsLoadingCell] = useState(false);
  const [cellError, setCellError] = useState(null);
  const [isVisualMotionPaused, setVisualMotionPaused] = useState(false);
  const [isCultivating, setCultivating] = useState(false);
  const [dockMessage, setDockMessage] = useState("");
  const [dockError, setDockError] = useState("");
  const [aiSettings, setAiSettings] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [operationDialog, setOperationDialog] = useState(null);
  const [activeCellOperation, setActiveCellOperation] = useState(null);
  const [operationError, setOperationError] = useState("");
  const [operationChildCellId, setOperationChildCellId] = useState("");
  const [isFuseMenuOpen, setFuseMenuOpen] = useState(false);
  const [selectedFuseCellIds, setSelectedFuseCellIds] = useState([]);
  const operationRequestRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAiSettings() {
      try {
        const settings = await fetchAiSettings();

        if (!cancelled) {
          setAiSettings(settings);
        }
      } catch (settingsError) {
        if (!cancelled) {
          setDockError(settingsError.message);
        }
      }
    }

    loadAiSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cells.length === 0) {
      setSelectedCellId(null);
      setSelectedCell(null);
      return;
    }

    if (selectedCellId && cells.some((cell) => cell.id === selectedCellId)) {
      return;
    }

    const nextCell = cells.find((cell) => cell.active === true) ?? cells[0];
    setSelectedCellId(nextCell.id);
  }, [cells, selectedCellId]);

  useEffect(() => {
    if (!selectedCellId) {
      return undefined;
    }

    const summary = cells.find((cell) => cell.id === selectedCellId);
    let cancelled = false;

    setSelectedCell(summary ?? null);
    setIsLoadingCell(true);
    setCellError(null);

    async function loadCellDetails() {
      const results = await Promise.allSettled([
        fetchCell(selectedCellId),
        fetchCellDna(selectedCellId),
        fetchCellMaturity(selectedCellId),
        fetchCellLifecycleDecision(selectedCellId),
        fetchCellWorkspace(selectedCellId),
      ]);

      if (cancelled) {
        return;
      }

      const [
        cellResult,
        dnaResult,
        maturityResult,
        lifecycleResult,
        workspaceResult,
      ] = results;
      const hasFailure = results.some((result) => result.status === "rejected");
      const detail = cellResult.status === "fulfilled"
        ? cellResult.value
        : summary;

      setSelectedCell({
        ...summary,
        ...detail,
        dna: dnaResult.status === "fulfilled" ? dnaResult.value : undefined,
        maturity: maturityResult.status === "fulfilled"
          ? maturityResult.value.maturity ?? maturityResult.value
          : summary?.maturity,
        lifecycleDecision: lifecycleResult.status === "fulfilled"
          ? lifecycleResult.value
          : undefined,
        workspace: workspaceResult.status === "fulfilled"
          ? workspaceResult.value
          : undefined,
      });
      setCellError(hasFailure ? "Some Cell details could not be loaded." : null);
      setIsLoadingCell(false);
    }

    loadCellDetails();

    return () => {
      cancelled = true;
    };
  }, [cells, refreshVersion, selectedCellId]);

  const cultivationActions = useCellCultivationActions({
    onSuccess: async () => {
      await onReloadCells();
      setRefreshVersion((value) => value + 1);
    },
  });

  const selectedVisual = useMemo(
    () => selectedCell ? mapCellToVisualState(selectedCell) : null,
    [selectedCell],
  );
  const summary = useMemo(
    () => getIncubatorSummary(cells, { unavailable: isLoading || Boolean(error) }),
    [cells, error, isLoading],
  );

  function handleSelectCell(cellId) {
    if (cellId !== selectedCellId) {
      setOperationDialog(null);
      setOperationError("");
      setOperationChildCellId("");
      setFuseMenuOpen(false);
      setSelectedFuseCellIds([]);
    }

    setSelectedCellId(cellId);
  }

  function getSuggestedChildCellId() {
    const existingCellIds = new Set(cells.map((cell) => cell.id));
    let nextIndex = 1;

    while (existingCellIds.has(`cell-${String(nextIndex).padStart(3, "0")}`)) {
      nextIndex += 1;
    }

    return `cell-${String(nextIndex).padStart(3, "0")}`;
  }

  async function refreshIncubatorData() {
    await onReloadCells();
    setRefreshVersion((value) => value + 1);
  }

  function openStabilizeDialog() {
    if (!selectedCellId || activeCellOperation) {
      return;
    }

    setOperationError("");
    setOperationDialog("stabilize");
  }

  function openDivideDialog() {
    if (!selectedCellId || activeCellOperation) {
      return;
    }

    setOperationError("");
    setOperationChildCellId(getSuggestedChildCellId());
    setOperationDialog("divide");
  }

  function closeOperationDialog() {
    if (activeCellOperation) {
      return;
    }

    setOperationDialog(null);
    setOperationError("");
  }

  async function handleStabilize() {
    if (!selectedCellId || activeCellOperation || operationRequestRef.current) {
      return;
    }

    try {
      operationRequestRef.current = true;
      setActiveCellOperation("stabilize");
      setOperationError("");
      setDockError("");
      setDockMessage("");
      const result = await stabilizeCell(selectedCellId);
      await refreshIncubatorData();
      setOperationDialog(null);
      setDockMessage(formatStabilizeMessage(selectedCellId, result));
    } catch (operationFailure) {
      setOperationError(operationFailure.message);
      setDockError(operationFailure.message);
    } finally {
      operationRequestRef.current = false;
      setActiveCellOperation(null);
    }
  }

  async function handleDivide(event) {
    event.preventDefault();
    const childCellId = operationChildCellId.trim();

    if (
      !selectedCellId ||
      !childCellId ||
      activeCellOperation ||
      operationRequestRef.current
    ) {
      return;
    }

    try {
      operationRequestRef.current = true;
      setActiveCellOperation("divide");
      setOperationError("");
      setDockError("");
      setDockMessage("");
      const result = await divideCell(selectedCellId, { childCellId });
      await refreshIncubatorData();

      if (!result.complete) {
        const message =
          result.errors?.[0]?.message ??
          `Cell ${result.childCellId} was created, but division is incomplete.`;
        setOperationError(message);
        setDockError(message);
        return;
      }

      setOperationDialog(null);
      setOperationChildCellId("");
      setDockMessage(`Cell ${result.childCellId} created by division.`);
    } catch (operationFailure) {
      setOperationError(operationFailure.message);
      setDockError(operationFailure.message);
    } finally {
      operationRequestRef.current = false;
      setActiveCellOperation(null);
    }
  }

  function toggleFuseCell(cellId) {
    setSelectedFuseCellIds((current) =>
      current.includes(cellId)
        ? current.filter((id) => id !== cellId)
        : [...current, cellId]
    );
  }

  function cancelFuseFlow() {
    if (activeCellOperation) {
      return;
    }

    setFuseMenuOpen(false);
    setOperationDialog(null);
    setOperationError("");
    setOperationChildCellId("");
    setSelectedFuseCellIds([]);
  }

  function continueFuseFlow() {
    if (!selectedCellId || selectedFuseCellIds.length === 0) {
      return;
    }

    setFuseMenuOpen(false);
    setOperationError("");
    setOperationChildCellId((current) => current || getSuggestedChildCellId());
    setOperationDialog("fuse");
  }

  function backToFuseSelection() {
    if (activeCellOperation) {
      return;
    }

    setOperationDialog(null);
    setOperationError("");
    setFuseMenuOpen(true);
  }

  async function handleFuse(event) {
    event.preventDefault();
    const childCellId = operationChildCellId.trim();

    if (
      !selectedCellId ||
      selectedFuseCellIds.length === 0 ||
      !childCellId ||
      activeCellOperation ||
      operationRequestRef.current
    ) {
      return;
    }

    const parentCellIds = [selectedCellId, ...selectedFuseCellIds];

    try {
      operationRequestRef.current = true;
      setActiveCellOperation("fuse");
      setOperationError("");
      setDockError("");
      setDockMessage("");
      const result = await fuseCells({ parentCellIds, childCellId });
      await refreshIncubatorData();

      if (!result.complete) {
        const message =
          result.errors?.[0]?.message ??
          `Cell ${result.childCellId} was created, but fusion is incomplete.`;
        setOperationError(message);
        setDockError(message);
        return;
      }

      setOperationDialog(null);
      setFuseMenuOpen(false);
      setSelectedFuseCellIds([]);
      setOperationChildCellId("");
      setDockMessage(`Cell ${result.childCellId} created by fusion.`);
    } catch (operationFailure) {
      setOperationError(operationFailure.message);
      setDockError(operationFailure.message);
    } finally {
      operationRequestRef.current = false;
      setActiveCellOperation(null);
    }
  }

  async function handleRunOneCycle() {
    if (isCultivating) {
      return;
    }

    try {
      setCultivating(true);
      setDockMessage("");
      setDockError("");
      await startCultivation();
      await onReloadCells();
      setRefreshVersion((value) => value + 1);
      setDockMessage("Cultivation cycle completed.");
    } catch (cycleError) {
      setDockError(cycleError.message);
    } finally {
      setCultivating(false);
    }
  }

  function handleRetry() {
    onReloadCells().catch(() => {});
  }

  async function handleChangeAiSettings(nextSettings) {
    try {
      setDockMessage("");
      setDockError("");
      const settings = await updateAiSettings(nextSettings);
      setAiSettings({
        current: settings.current,
        options: settings.options,
      });
      setDockMessage(
        `AI settings updated: ${settings.current.provider} / ${settings.current.model}`,
      );
    } catch (settingsError) {
      setDockError(settingsError.message);
    }
  }

  return (
    <div className="incubator-page">
      <IncubatorWorkspace
        cells={cells}
        selectedCellId={selectedCellId}
        isLoading={isLoading}
        error={error}
        isVisualMotionPaused={isVisualMotionPaused}
        isCultivating={isCultivating}
        summary={summary}
        aiSettings={aiSettings}
        dockMessage={dockMessage}
        dockError={dockError}
        activeCellOperation={activeCellOperation}
        isFuseMenuOpen={isFuseMenuOpen}
        selectedFuseCellIds={selectedFuseCellIds}
        onSelectCell={handleSelectCell}
        onRunOneCycle={handleRunOneCycle}
        onToggleVisualMotion={() => setVisualMotionPaused((value) => !value)}
        onChangeAiSettings={handleChangeAiSettings}
        onOpenStabilize={openStabilizeDialog}
        onOpenDivide={openDivideDialog}
        onToggleFuseMenu={() => setFuseMenuOpen((value) => !value)}
        onToggleFuseCell={toggleFuseCell}
        onCancelFuse={cancelFuseFlow}
        onContinueFuse={continueFuseFlow}
        onCloseFuseMenu={() => setFuseMenuOpen(false)}
        onRetry={handleRetry}
        onCreateCell={onCreateCell}
      />

      <SelectedCellPanel
        cell={selectedCell}
        visual={selectedVisual}
        isLoading={isLoading || isLoadingCell}
        error={cellError}
        activeAction={cultivationActions.activeAction}
        actionMessage={cultivationActions.message}
        actionError={cultivationActions.error}
        onActivate={() => cultivationActions.activate(selectedCellId)}
        onDeactivate={() => cultivationActions.deactivate(selectedCellId)}
      />

      <CellOperationDialogs
        dialog={operationDialog}
        selectedCellId={selectedCellId}
        selectedFuseCellIds={selectedFuseCellIds}
        childCellId={operationChildCellId}
        activeOperation={activeCellOperation}
        error={operationError}
        onChangeChildCellId={setOperationChildCellId}
        onClose={closeOperationDialog}
        onBackToFuseSelection={backToFuseSelection}
        onConfirmStabilize={handleStabilize}
        onConfirmDivide={handleDivide}
        onConfirmFuse={handleFuse}
      />
    </div>
  );
}
