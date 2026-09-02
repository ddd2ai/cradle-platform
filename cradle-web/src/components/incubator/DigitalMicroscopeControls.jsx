import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

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
  const { t } = useUiPreferences();
  const magnificationPercentage = Math.round((900 / camera.distance) * 100);

  return (
    <section
      className="microscope-controls"
      aria-label={t("incubator.microscopeNavigation")}
    >
      <div className="microscope-controls__panel">
        <div className="microscope-controls__dpad">
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--forward"
            onClick={onMoveForward}
            aria-label={t("incubator.moveForward")}
            title={t("incubator.moveForward")}
          >
            ↑
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--left"
            onClick={onOrbitLeft}
            aria-label={t("incubator.orbitLeft")}
            title={t("incubator.orbitLeft")}
          >
            ←
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--right"
            onClick={onOrbitRight}
            aria-label={t("incubator.orbitRight")}
            title={t("incubator.orbitRight")}
          >
            →
          </button>
          <button
            type="button"
            className="microscope-controls__dpad-button microscope-controls__dpad-button--backward"
            onClick={onMoveBackward}
            aria-label={t("incubator.moveBackward")}
            title={t("incubator.moveBackward")}
          >
            ↓
          </button>
        </div>

        <button
          type="button"
          className="microscope-controls__focus"
          onClick={onFocusSelected}
          disabled={!hasSelectedCell}
          aria-label={t("incubator.focusCell")}
          title={t("incubator.focusCell")}
        >
          ◎
        </button>

        <div className="microscope-controls__divider" aria-hidden="true" />

        <div className="microscope-controls__zoom">
          <button
            type="button"
            onClick={onMoveBackward}
            aria-label={t("incubator.decreaseMagnification")}
            title={t("incubator.decreaseMagnification")}
          >
            −
          </button>
          <span className="microscope-controls__magnification">
            {magnificationPercentage}%
          </span>
          <button
            type="button"
            onClick={onMoveForward}
            aria-label={t("incubator.increaseMagnification")}
            title={t("incubator.increaseMagnification")}
          >
            +
          </button>
          <button
            type="button"
            className="microscope-controls__reset"
            onClick={onReset}
            aria-label={t("incubator.resetCamera")}
            title={t("incubator.resetView")}
          >
            {t("common.reset")}
          </button>
        </div>
      </div>
    </section>
  );
}
