export function DigitalMicroscopeControls({
  camera,
  onOrbitLeft,
  onMoveForward,
  onMoveBackward,
  onOrbitRight,
  onFocusSelected,
  onReset,
  hasSelectedCell,
}) {
  return (
    <section
      className="microscope-controls"
      aria-label="Digital microscope navigation"
    >
      <span className="microscope-controls__label">Microscope</span>

      <div className="microscope-controls__buttons">
        <button
          type="button"
          onClick={onOrbitLeft}
          aria-label="Orbit left"
          title="Orbit left"
        >
          ←
        </button>

        <button
          type="button"
          onClick={onMoveForward}
          aria-label="Move camera forward"
          title="Move forward"
        >
          ↑
        </button>

        <button
          type="button"
          onClick={onMoveBackward}
          aria-label="Move camera backward"
          title="Move backward"
        >
          ↓
        </button>

        <button
          type="button"
          onClick={onOrbitRight}
          aria-label="Orbit right"
          title="Orbit right"
        >
          →
        </button>

        <button
          type="button"
          onClick={onFocusSelected}
          disabled={!hasSelectedCell}
          aria-label="Focus selected cell"
          title="Focus selected cell"
        >
          ◎
        </button>

        <button
          type="button"
          onClick={onReset}
          aria-label="Reset microscope camera"
          title="Reset view"
        >
          ⌂
        </button>
      </div>

      <span className="microscope-controls__distance">
        {getDistanceLabel(camera.distance)}
      </span>
    </section>
  );
}

function getDistanceLabel(distance) {
  if (distance < 600) {
    return "Close inspection";
  }

  if (distance > 1200) {
    return "Colony overview";
  }

  return "Standard view";
}
