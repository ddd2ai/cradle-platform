import { useMemo, useState } from "react";
import { CellFeedComposer } from "./CellFeedComposer";
import { CultivationProgressCard } from "./CultivationProgressCard";
import { CultivateButton } from "./CultivateButton";
import { DigitalMicroscopeControls } from "./DigitalMicroscopeControls";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

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
  acceptedOperation,
  artifactTypes,
  artifactType,
  feedError,
  feedMessage,
  isFeeding,
  onFeedFiles,
  onArtifactTypeChange,
  onDismissFeedOperation,
}) {
  const { t } = useUiPreferences();
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
  const isFeedDisabled = isFeeding;
  const feedStatusMessage = feedError || feedMessage;
  const feedStatusTone = feedError ? "error" : "success";

  async function handleFeedSubmit() {
    const content = feedInput.trim();

    if (!content) {
      return;
    }
    const note = new File([content], `note-${Date.now()}.txt`, { type: "text/plain" });
    await onFeedFiles([note]);
    setFeedInput("");
  }

  return (
    <div className={viewportClassName}>
      <div className="cradle-control-dock incubator-control-bar">
        <div
          className="incubator-control-bar__actions"
          aria-label={t("incubator.actions")}
        >
          <CultivateButton isRunning={isCultivating} onClick={onRunOneCycle} />
        </div>

        <div className="incubator-control-bar__divider" aria-hidden="true" />

        <div className="cell-feed-zone">
          <CellFeedComposer
            value={feedInput}
            onChange={setFeedInput}
            onSubmit={handleFeedSubmit}
            onFiles={onFeedFiles}
            artifactType={artifactType}
            artifactTypes={artifactTypes}
            onArtifactTypeChange={onArtifactTypeChange}
            disabled={isFeedDisabled}
            statusMessage={feedStatusMessage}
            statusTone={feedStatusTone}
          />
          <CultivationProgressCard
            operationId={acceptedOperation?.operationId ?? null}
            acceptedOperation={acceptedOperation}
            selectedCell={selectedCell}
            onDismiss={onDismissFeedOperation}
          />
        </div>

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
