import {
  CENTER_CELL_LAYOUT,
  PERIPHERAL_CELL_LAYOUTS,
} from "../../constants/incubatorVisuals";
import { mapCellToVisualState } from "../../domain/cellVisualMapper";
import { AmbientParticles } from "./AmbientParticles";
import { FloatingCell } from "./FloatingCell";

const GENERATED_RING_CENTER = { x: 50, y: 49 };

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

      </div>
    </div>
  );
}

function arrangeCells(cells, selectedCellId) {
  const visuals = cells.map(mapCellToVisualState);
  const selected = visuals.find((cell) => cell.id === selectedCellId) ?? visuals[0];
  const remaining = visuals.filter((cell) => cell.id !== selected?.id);
  const visible = selected
    ? [selected, ...remaining]
    : [];
  const peripheralCount = Math.max(0, visible.length - 1);

  return visible.map((visual, index) => ({
    visual,
    layout: index === 0
      ? CENTER_CELL_LAYOUT
      : getPeripheralLayout(index - 1, peripheralCount),
  }));
}

function getPeripheralLayout(index, count) {
  const baseLayout = count <= PERIPHERAL_CELL_LAYOUTS.length
    ? PERIPHERAL_CELL_LAYOUTS[index]
    : null;

  if (baseLayout) {
    return scalePeripheralLayout(baseLayout, count);
  }

  return createGeneratedPeripheralLayout(index, count);
}

function scalePeripheralLayout(layout, count) {
  if (count <= 8) {
    return layout;
  }

  return {
    ...layout,
    size: getPeripheralCellSize(count),
  };
}

function createGeneratedPeripheralLayout(index, count) {
  const ringCount = count > 18 ? 2 : 1;
  const ringIndex = ringCount === 1 ? 0 : index % ringCount;
  const slotIndex = ringCount === 1 ? index : Math.floor(index / ringCount);
  const slotsInRing = Math.ceil(count / ringCount);
  const angle = ((slotIndex / slotsInRing) * Math.PI * 2)
    + (ringIndex === 0 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / slotsInRing);
  const radiusX = ringIndex === 0 ? 40 : 29;
  const radiusY = ringIndex === 0 ? 35 : 24;

  return {
    x: Math.round((GENERATED_RING_CENTER.x + Math.cos(angle) * radiusX) * 10) / 10,
    y: Math.round((GENERATED_RING_CENTER.y + Math.sin(angle) * radiusY) * 10) / 10,
    size: getPeripheralCellSize(count),
    delay: Number((-1.4 - index * 0.37).toFixed(2)),
    driftDuration: Number((9.6 + (index % 7) * 0.7).toFixed(1)),
    breatheDuration: Number((3.8 + (index % 5) * 0.24).toFixed(1)),
    coreDuration: Number((2.6 + (index % 4) * 0.18).toFixed(1)),
    glowDuration: Number((4.2 + (index % 6) * 0.2).toFixed(1)),
    driftX: index % 2 === 0 ? 7 : -8,
    driftY: index % 3 === 0 ? -10 : 9,
  };
}

function getPeripheralCellSize(count) {
  if (count > 28) {
    return 42;
  }

  if (count > 18) {
    return 50;
  }

  if (count > 10) {
    return 58;
  }

  return 70;
}
