import { useMemo, useState } from "react";
import { CellFeedComposer } from "./CellFeedComposer";
import { CultivateButton } from "./CultivateButton";
import { DigitalMicroscopeControls } from "./DigitalMicroscopeControls";

export function IncubatorControlBar({
  cells,
  isCultivating,
  message,
  error,
  selectedCellId,
  isInspectorOpen,
  onRunOneCycle,
  camera,
  onOrbitLeft,
  onMoveForward,
  onMoveBackward,
  onOrbitRight,
  onFocusSelectedCell,
  onResetCamera,
}) {
  const [feedInput, setFeedInput] = useState("");
  const hasSelectedCell = Boolean(selectedCellId);
  const selectedCell = useMemo(
    () => cells.find((cell) => cell.id === selectedCellId) ?? null,
    [cells, selectedCellId],
  );
  const viewportClassName = [
    "cradle-control-dock__viewport",
    isInspectorOpen ? "cradle-control-dock__viewport--inspector-open" : "",
  ].filter(Boolean).join(" ");
  const isFeedDisabled = !selectedCell;

  function handleFeedSubmit() {
    const content = feedInput.trim();

    if (!selectedCellId || !content) {
      return;
    }

    console.log({
      cellId: selectedCellId,
      content,
    });
    setFeedInput("");
  }

  return (
    <div className={viewportClassName}>
      <div className="cradle-control-dock incubator-control-bar">
        <div
          className="incubator-control-bar__actions"
          aria-label="Cultivation actions"
        >
          <CultivateButton isRunning={isCultivating} onClick={onRunOneCycle} />
        </div>

        <div className="incubator-control-bar__divider" aria-hidden="true" />

        {selectedCell ? (
          <CellFeedComposer
            value={feedInput}
            selectedCell={selectedCell}
            onChange={setFeedInput}
            onSubmit={handleFeedSubmit}
            disabled={isFeedDisabled}
          />
        ) : null}

        <DigitalMicroscopeControls
          camera={camera}
          hasSelectedCell={hasSelectedCell}
          onOrbitLeft={onOrbitLeft}
          onMoveForward={onMoveForward}
          onMoveBackward={onMoveBackward}
          onOrbitRight={onOrbitRight}
          onFocusSelected={onFocusSelectedCell}
          onReset={onResetCamera}
        />

        <div
          className={`cradle-dock-feedback${error ? " is-error" : ""}`}
          aria-live="polite"
        >
          {error || message}
        </div>
      </div>
    </div>
  );
}
