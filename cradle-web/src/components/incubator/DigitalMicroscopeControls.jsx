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
  const magnificationPercentage = Math.round((900 / camera.distance) * 100);

  return (
    <section
      className="microscope-controls"
      aria-label="Digital microscope navigation"
    >
      <div className="microscope-controls__panel">
        <div className="microscope-controls__dpad">
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--forward"
            onClick={onMoveForward}
            aria-label="Move camera forward"
            title="Move forward"
          >
            ↑
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--left"
            onClick={onOrbitLeft}
            aria-label="Orbit left"
            title="Orbit left"
          >
            ←
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--focus"
            onClick={onFocusSelected}
            disabled={!hasSelectedCell}
            aria-label="Focus selected cell"
            title="Focus selected cell"
          >
            ◎
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--right"
            onClick={onOrbitRight}
            aria-label="Orbit right"
            title="Orbit right"
          >
            →
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--backward"
            onClick={onMoveBackward}
            aria-label="Move camera backward"
            title="Move backward"
          >
            ↓
          </button>
        </div>

        <div className="microscope-controls__divider" aria-hidden="true" />

        <div className="microscope-controls__zoom">
          <button
            type="button"
            onClick={onMoveBackward}
            aria-label="Move camera backward"
            title="Decrease magnification"
          >
            −
          </button>
          <span className="microscope-controls__magnification">
            {magnificationPercentage}%
          </span>
          <button
            type="button"
            onClick={onMoveForward}
            aria-label="Move camera forward"
            title="Increase magnification"
          >
            +
          </button>
          <button
            type="button"
            className="microscope-controls__reset"
            onClick={onReset}
            aria-label="Reset microscope camera"
            title="Reset view"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
