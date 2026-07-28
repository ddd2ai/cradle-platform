import {
  CENTER_CELL_LAYOUT,
  PERIPHERAL_CELL_LAYOUTS,
} from "../../constants/incubatorVisuals";
import { mapCellToVisualState } from "../../domain/cellVisualMapper";
import { AmbientParticles } from "./AmbientParticles";
import { FloatingCell } from "./FloatingCell";

const MAX_VISIBLE_CELLS = 5;

export function IncubatorDish({
  dishRef,
  cells,
  selectedCellId,
  isLoading,
  error,
  isMotionPaused,
  isFocusActive,
  onSelectCell,
  onRetry,
  onCreateCell,
}) {
  const positionedCells = arrangeCells(cells, selectedCellId);
  const hiddenCellCount = Math.max(0, cells.length - MAX_VISIBLE_CELLS);
  const className = [
    "incubator-dish",
    isMotionPaused ? "is-motion-paused" : "",
    isFocusActive ? "is-focus-active" : "",
  ].filter(Boolean).join(" ");

  return (
    <div ref={dishRef} className={className}>
      <div className="incubator-dish__field">
        <AmbientParticles />

        {!isLoading && positionedCells.map(({ visual, layout }) => (
          <FloatingCell
            key={visual.id}
            visual={visual}
            layout={layout}
            primary={layout === CENTER_CELL_LAYOUT}
            selected={visual.id === selectedCellId}
            dimmed={selectedCellId !== null && visual.id !== selectedCellId}
            focused={isFocusActive}
            onSelect={onSelectCell}
          />
        ))}

        {isLoading && (
          <div className="incubator-dish__loading" aria-label="Loading cells">
            <span />
            <span />
            <span />
          </div>
        )}

        {!isLoading && cells.length === 0 && !error && (
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

        {hiddenCellCount > 0 && (
          <div className="incubator-overflow-count">+{hiddenCellCount}</div>
        )}

      </div>
    </div>
  );
}

function arrangeCells(cells, selectedCellId) {
  const visuals = cells.map(mapCellToVisualState);
  const selected = visuals.find((cell) => cell.id === selectedCellId) ?? visuals[0];
  const remaining = visuals.filter((cell) => cell.id !== selected?.id);
  const visible = selected
    ? [selected, ...remaining].slice(0, MAX_VISIBLE_CELLS)
    : [];

  return visible.map((visual, index) => ({
    visual,
    layout: index === 0
      ? CENTER_CELL_LAYOUT
      : PERIPHERAL_CELL_LAYOUTS[index - 1],
  }));
}
