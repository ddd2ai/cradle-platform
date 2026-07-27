import { useEffect, useMemo, useState } from "react";
import {
  fetchCell,
  fetchCellDna,
  fetchCellLifecycleDecision,
  fetchCellMaturity,
  fetchAiSettings,
  startCultivation,
  updateAiSettings,
} from "../api/cradleClient";
import { IncubatorWorkspace } from "../components/incubator/IncubatorWorkspace";
import { SelectedCellPanel } from "../components/incubator/SelectedCellPanel";
import { mapCellToVisualState } from "../domain/cellVisualMapper";
import { getIncubatorSummary } from "../domain/incubatorSummary";
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
      ]);

      if (cancelled) {
        return;
      }

      const [cellResult, dnaResult, maturityResult, lifecycleResult] = results;
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
    setSelectedCellId(cellId);
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
        onSelectCell={handleSelectCell}
        onRunOneCycle={handleRunOneCycle}
        onToggleVisualMotion={() => setVisualMotionPaused((value) => !value)}
        onChangeAiSettings={handleChangeAiSettings}
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
    </div>
  );
}
