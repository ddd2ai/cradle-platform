import { useEffect, useMemo, useState } from "react";
import { feedCell } from "../../api/cradleClient";
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
  const [isFeeding, setIsFeeding] = useState(false);
  const [feedMessage, setFeedMessage] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const hasSelectedCell = Boolean(selectedCellId);
  const selectedCell = useMemo(
    () => cells.find((cell) => cell.id === selectedCellId) ?? null,
    [cells, selectedCellId],
  );
  const viewportClassName = [
    "cradle-control-dock__viewport",
    isInspectorOpen ? "cradle-control-dock__viewport--inspector-open" : "",
  ].filter(Boolean).join(" ");
  const isFeedDisabled = !selectedCell || isFeeding;
  const feedStatusMessage = feedError || feedMessage;
  const feedStatusTone = feedError ? "error" : "success";

  useEffect(() => {
    if (!feedMessage || isFeeding) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedMessage(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedMessage, isFeeding]);

  async function handleFeedSubmit() {
    const content = feedInput.trim();

    if (!selectedCellId || !content) {
      return;
    }

    setIsFeeding(true);
    setFeedError(null);
    setFeedMessage(`Feeding ${selectedCellId}...`);

    try {
      await feedCell(selectedCellId, { content });
      setFeedInput("");
      setFeedMessage(`Feed delivered to ${selectedCellId}. Run Cultivate to metabolize it.`);
    } catch (feedFailure) {
      setFeedError(feedFailure.message);
    } finally {
      setIsFeeding(false);
    }
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
            statusMessage={feedStatusMessage}
            statusTone={feedStatusTone}
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
