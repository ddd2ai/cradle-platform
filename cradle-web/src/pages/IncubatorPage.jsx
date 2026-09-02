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
import { CellInspectorDrawer } from "../components/incubator/CellInspectorDrawer";
import { CellOperationDialogs } from "../components/incubator/CellOperationDialogs";
import { IncubatorWorkspace } from "../components/incubator/IncubatorWorkspace";
import { mapCellToVisualState } from "../domain/cellVisualMapper";
import { getIncubatorSummary } from "../domain/incubatorSummary";
import { useCellCultivationActions } from "../hooks/useCellCultivationActions";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function IncubatorPage({
  cells,
  isLoading,
  error,
  onReloadCells,
  onCreateCell,
}) {
  const { t } = useUiPreferences();
  const [selectedCellId, setSelectedCellId] = useState(undefined);
  const [selectedCell, setSelectedCell] = useState(null);
  const [isLoadingCell, setIsLoadingCell] = useState(false);
  const [cellError, setCellError] = useState(null);
  const isVisualMotionPaused = false;
  const [isCultivating, setCultivating] = useState(false);
  const [dockMessage, setDockMessage] = useState("");
  const [dockError, setDockError] = useState("");
  const [aiSettings, setAiSettings] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [operationDialog, setOperationDialog] = useState(null);
  const [activeCellOperation, setActiveCellOperation] = useState(null);
  const [activeOperationId, setActiveOperationId] = useState(null);
  const [operationError, setOperationError] = useState("");
  const [operationChildCellId, setOperationChildCellId] = useState("");
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

    if (selectedCellId === undefined) {
      setSelectedCellId(null);
      return;
    }

    if (selectedCellId && cells.some((cell) => cell.id === selectedCellId)) {
      return;
    }

    if (selectedCellId) {
      setSelectedCellId(null);
      setSelectedCell(null);
    }
  }, [cells, selectedCellId]);

  useEffect(() => {
    if (!selectedCellId) {
      setSelectedCell(null);
      setIsLoadingCell(false);
      setCellError(null);
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
      setCellError(hasFailure ? true : null);
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
  const fuseCandidates = useMemo(
    () => cells.filter((cell) => cell.id !== selectedCellId),
    [cells, selectedCellId],
  );

  function handleSelectCell(cellId) {
    if (cellId !== selectedCellId) {
      setOperationDialog(null);
      setOperationError("");
      setOperationChildCellId("");
      setSelectedFuseCellIds([]);
    }

    setSelectedCellId(cellId);
  }

  function handleClearSelectedCell() {
    setSelectedCellId(null);
    setSelectedCell(null);
    setOperationDialog(null);
    setOperationError("");
    setOperationChildCellId("");
    setSelectedFuseCellIds([]);
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
      setActiveOperationId(null);
      setOperationError("");
      setDockError("");
      setDockMessage("");
      const result = await stabilizeCell(selectedCellId, {
        onProgress: (op) => {
          if (op?.operationId) setActiveOperationId(op.operationId);
        },
      });
      await refreshIncubatorData();
      setOperationDialog(null);
      setDockMessage(translateStabilizeResult(selectedCellId, result, t));
    } catch (operationFailure) {
      setOperationError(operationFailure.message);
      setDockError(operationFailure.message);
    } finally {
      operationRequestRef.current = false;
      setActiveCellOperation(null);
      setActiveOperationId(null);
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
      setActiveOperationId(null);
      setOperationError("");
      setDockError("");
      setDockMessage("");
      const result = await divideCell(
        selectedCellId,
        { childCellId },
        {
          onProgress: (op) => {
            if (op?.operationId) setActiveOperationId(op.operationId);
          },
        },
      );
      await refreshIncubatorData();

      if (!result.complete) {
        const message =
          result.errors?.[0]?.message ??
          t("cell.divideIncomplete", { cell: result.childCellId });
        setOperationError(message);
        setDockError(message);
        return;
      }

      setOperationDialog(null);
      setOperationChildCellId("");
      setDockMessage(t("cell.divideComplete", { cell: result.childCellId }));
    } catch (operationFailure) {
      setOperationError(operationFailure.message);
      setDockError(operationFailure.message);
    } finally {
      operationRequestRef.current = false;
      setActiveCellOperation(null);
      setActiveOperationId(null);
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

    setOperationDialog(null);
    setOperationError("");
    setOperationChildCellId("");
    setSelectedFuseCellIds([]);
  }

  function openFuseSelection() {
    if (!selectedCellId || activeCellOperation) {
      return;
    }

    setOperationDialog(null);
    setOperationError("");
    setOperationChildCellId("");
    setSelectedFuseCellIds([]);
  }

  function continueFuseFlow() {
    if (!selectedCellId || selectedFuseCellIds.length === 0) {
      return;
    }

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
      setActiveOperationId(null);
      setOperationError("");
      setDockError("");
      setDockMessage("");
      const result = await fuseCells(
        { parentCellIds, childCellId },
        {
          onProgress: (op) => {
            if (op?.operationId) setActiveOperationId(op.operationId);
          },
        },
      );
      await refreshIncubatorData();

      if (!result.complete) {
        const message =
          result.errors?.[0]?.message ??
          t("cell.fuseIncomplete", { cell: result.childCellId });
        setOperationError(message);
        setDockError(message);
        return;
      }

      setOperationDialog(null);
      setSelectedFuseCellIds([]);
      setOperationChildCellId("");
      setDockMessage(t("cell.fuseComplete", { cell: result.childCellId }));
    } catch (operationFailure) {
      setOperationError(operationFailure.message);
      setDockError(operationFailure.message);
    } finally {
      operationRequestRef.current = false;
      setActiveCellOperation(null);
      setActiveOperationId(null);
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
      setDockMessage(t("incubator.cycleComplete"));
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
        t("incubator.aiUpdated", { provider: settings.current.provider, model: settings.current.model }),
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
        onSelectCell={handleSelectCell}
        onClearSelectedCell={handleClearSelectedCell}
        onRunOneCycle={handleRunOneCycle}
        onChangeAiSettings={handleChangeAiSettings}
        onRetry={handleRetry}
        onCreateCell={onCreateCell}
      />

      <CellInspectorDrawer
        cell={selectedCell}
        visual={selectedVisual}
        isOpen={Boolean(selectedCellId)}
        isLoading={isLoading || isLoadingCell}
        error={cellError}
        activeAction={cultivationActions.activeAction}
        actionMessage={cultivationActions.message}
        actionError={cultivationActions.error}
        activeOperation={activeCellOperation}
        operationError={operationError}
        fuseCandidates={fuseCandidates}
        selectedFuseCellIds={selectedFuseCellIds}
        onActivate={() => selectedCellId && cultivationActions.activate(selectedCellId)}
        onDeactivate={() => selectedCellId && cultivationActions.deactivate(selectedCellId)}
        onClose={handleClearSelectedCell}
        onStabilize={openStabilizeDialog}
        onDivide={openDivideDialog}
        onOpenFuseSelection={openFuseSelection}
        onToggleFuseCell={toggleFuseCell}
        onCancelFuse={cancelFuseFlow}
        onContinueFuse={continueFuseFlow}
      />

      <CellOperationDialogs
        dialog={operationDialog}
        selectedCellId={selectedCellId}
        selectedFuseCellIds={selectedFuseCellIds}
        childCellId={operationChildCellId}
        activeOperation={activeCellOperation}
        operationId={activeOperationId}
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

function translateStabilizeResult(cellId, result, t) {
  const artifactId = result?.diagnosis?.artifactId ?? result?.execution?.result?.artifactId;
  if (result?.patched) {
    return artifactId
      ? t("cell.repairedArtifact", { cell: cellId, artifact: artifactId })
      : t("cell.repaired", { cell: cellId });
  }
  if (result?.diagnosed) return t("cell.noRepair", { cell: cellId });
  return t("cell.stabilizeComplete", { cell: cellId });
}
