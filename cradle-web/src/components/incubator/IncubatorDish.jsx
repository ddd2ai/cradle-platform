import { mapCellToVisualState } from "../../domain/cellVisualMapper";
import { FloatingCell } from "./FloatingCell";

export function IncubatorDish({
  dishRef,
  projectedCells = [],
  selectedCellId,
  isLoading,
  error,
  isMotionPaused,
  onSelectCell,
  onFocusCell,
  onRetry,
  onCreateCell,
}) {
  const className = [
    "incubator-dish",
    isMotionPaused ? "is-motion-paused" : "",
  ].filter(Boolean).join(" ");
  const hasCells = projectedCells.length > 0;

  return (
    <div ref={dishRef} className={className}>
      <div className="incubator-dish__field">
        <div className="incubator-depth-field" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {!isLoading && (
          <div className="incubator-dish__view">
            {projectedCells.map(({ cell, projection, size, primary }) => (
              <FloatingCell
                key={cell.id}
                visual={mapCellToVisualState(cell)}
                projection={projection}
                size={size}
                primary={primary}
                selected={cell.id === selectedCellId}
                dimmed={selectedCellId !== null && cell.id !== selectedCellId}
                onSelect={onSelectCell}
                onFocus={onFocusCell}
              />
            ))}
          </div>
        )}

        {isLoading && (
          <div className="incubator-dish__loading" aria-label="Loading cells">
            <span />
            <span />
            <span />
          </div>
        )}

        {!isLoading && !hasCells && !error && (
          <div className="incubator-empty-state">
            <span className="incubator-empty-state__mark" aria-hidden="true">+</span>
            <h3>No living cells yet</h3>
            <p>Create a new Cell to begin cultivation.</p>
            <button type="button" onClick={onCreateCell}>New Cell</button>
          </div>
        )}

        {!isLoading && error && (
          <div className="incubator-error-state">
            <p>Unable to load cells.</p>
            <button type="button" onClick={onRetry}>Retry</button>
          </div>
        )}

      </div>
    </div>
  );
}
