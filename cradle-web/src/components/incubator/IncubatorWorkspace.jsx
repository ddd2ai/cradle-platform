import { IncubatorControlBar } from "./IncubatorControlBar";
import { IncubatorDish } from "./IncubatorDish";
import { IncubatorStats } from "./IncubatorStats";

export function IncubatorWorkspace({
  cells,
  selectedCellId,
  isLoading,
  error,
  isVisualMotionPaused,
  isCultivating,
  summary,
  dockMessage,
  dockError,
  activeCellOperation,
  isFuseMenuOpen,
  selectedFuseCellIds,
  onSelectCell,
  onRunOneCycle,
  onToggleVisualMotion,
  onOpenStabilize,
  onOpenDivide,
  onToggleFuseMenu,
  onToggleFuseCell,
  onCancelFuse,
  onContinueFuse,
  onCloseFuseMenu,
  onRetry,
  onCreateCell,
}) {
  return (
    <section className="incubator-workspace">
      <div className="incubator-stage">
        <div className="incubator-stage__visual">
          <div className="incubator-stage__stats">
            <IncubatorStats summary={summary} />
          </div>

          <IncubatorDish
            cells={cells}
            selectedCellId={selectedCellId}
            isLoading={isLoading}
            error={error}
            isMotionPaused={isVisualMotionPaused}
            isFocusActive={false}
            onSelectCell={onSelectCell}
            onRetry={onRetry}
            onCreateCell={onCreateCell}
          />
        </div>

        <div className="incubator-hint">
          <span aria-hidden="true">ⓘ</span>
          <span>Tip: Click a Cell to inspect its details</span>
        </div>

        <IncubatorControlBar
          isVisualMotionPaused={isVisualMotionPaused}
          isCultivating={isCultivating}
          message={dockMessage}
          error={dockError}
          cells={cells}
          selectedCellId={selectedCellId}
          activeCellOperation={activeCellOperation}
          isFuseMenuOpen={isFuseMenuOpen}
          selectedFuseCellIds={selectedFuseCellIds}
          onRunOneCycle={onRunOneCycle}
          onToggleVisualMotion={onToggleVisualMotion}
          onOpenStabilize={onOpenStabilize}
          onOpenDivide={onOpenDivide}
          onToggleFuseMenu={onToggleFuseMenu}
          onToggleFuseCell={onToggleFuseCell}
          onCancelFuse={onCancelFuse}
          onContinueFuse={onContinueFuse}
          onCloseFuseMenu={onCloseFuseMenu}
        />
      </div>
    </section>
  );
}
