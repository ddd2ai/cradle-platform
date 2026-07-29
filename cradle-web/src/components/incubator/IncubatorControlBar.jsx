import { CultivateButton } from "./CultivateButton";
import { DigitalMicroscopeControls } from "./DigitalMicroscopeControls";
import { DivideButton } from "./DivideButton";
import { FuseButton } from "./FuseButton";
import { StabilizeButton } from "./StabilizeButton";

export function IncubatorControlBar({
  isCultivating,
  message,
  error,
  cells,
  selectedCellId,
  activeCellOperation,
  isFuseMenuOpen,
  selectedFuseCellIds,
  onRunOneCycle,
  onOpenStabilize,
  onOpenDivide,
  onToggleFuseMenu,
  onToggleFuseCell,
  onCancelFuse,
  onContinueFuse,
  onCloseFuseMenu,
  camera,
  onOrbitLeft,
  onMoveForward,
  onMoveBackward,
  onOrbitRight,
  onFocusSelectedCell,
  onResetCamera,
}) {
  const hasSelectedCell = Boolean(selectedCellId);
  const hasFuseTarget = cells.some((cell) => cell.id !== selectedCellId);
  const isOperationRunning = Boolean(activeCellOperation);

  return (
    <div className="cradle-control-dock__viewport">
      <div className="cradle-control-dock incubator-control-bar">
        <div
          className="incubator-control-bar__actions"
          aria-label="Cultivation actions"
        >
          <CultivateButton isRunning={isCultivating} onClick={onRunOneCycle} />

          <StabilizeButton
            disabled={!hasSelectedCell || isOperationRunning}
            isRunning={activeCellOperation === "stabilize"}
            title={!hasSelectedCell ? "Select a cell first" : "Stabilize selected Cell"}
            onClick={onOpenStabilize}
          />
          <DivideButton
            disabled={!hasSelectedCell || isOperationRunning}
            isRunning={activeCellOperation === "divide"}
            title={!hasSelectedCell ? "Select a cell first" : "Divide selected Cell"}
            onClick={onOpenDivide}
          />
          <FuseButton
            cells={cells}
            selectedCellId={selectedCellId}
            selectedCellIds={selectedFuseCellIds}
            disabled={!hasSelectedCell || !hasFuseTarget || isOperationRunning}
            isRunning={activeCellOperation === "fuse"}
            isOpen={isFuseMenuOpen}
            title={
              !hasSelectedCell
                ? "Select a cell first"
                : !hasFuseTarget
                  ? "At least two cells are required"
                  : "Fuse selected Cell with other Cells"
            }
            onToggle={() => {
              onToggleFuseMenu();
            }}
            onToggleCell={onToggleFuseCell}
            onCancel={onCancelFuse}
            onContinue={onContinueFuse}
            onClose={onCloseFuseMenu}
          />
        </div>

        <div className="incubator-control-bar__divider" aria-hidden="true" />

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
