import { CultivateButton } from "./CultivateButton";
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
}) {
  const hasSelectedCell = Boolean(selectedCellId);
  const hasFuseTarget = cells.some((cell) => cell.id !== selectedCellId);
  const isOperationRunning = Boolean(activeCellOperation);

  return (
    <div className="cradle-control-dock__viewport">
      <div className="cradle-control-dock incubator-control-bar">
        <CultivateButton isRunning={isCultivating} onClick={onRunOneCycle} />

        <div
          className="cradle-control-dock__group cradle-control-dock__group--cell-actions"
          role="group"
          aria-label="Cell operations"
        >
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
