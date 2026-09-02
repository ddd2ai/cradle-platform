function createFilaments(count) {
  return Array.from({ length: count }, (_, index) => ({
    rotation: Math.round(index * (360 / count)),
    delay: Number((index * -0.18).toFixed(2)),
  }));
}

const FILAMENTS = createFilaments(10);
const PRIMARY_FILAMENTS = createFilaments(14);

export function FloatingCell({
  visual,
  projection,
  size,
  primary,
  selected,
  dimmed,
  onSelect,
  onFocus,
}) {
  const className = [
    "floating-cell",
    primary ? "is-primary" : "",
    selected ? "is-selected" : "",
    dimmed ? "is-dimmed" : "",
    selected ? "is-focus-target" : "",
  ].filter(Boolean).join(" ");
  const filaments = primary ? PRIMARY_FILAMENTS : FILAMENTS;

  return (
    <button
      type="button"
      className={className}
      data-cell-id={visual.id}
      style={{
        left: `${projection.screenX}px`,
        top: `${projection.screenY}px`,
        zIndex: projection.zIndex,
        opacity: projection.opacity,
        "--cell-size": `${size}px`,
        "--cell-projection-scale": projection.scale,
        "--drift-duration": `${getMotionDuration(visual.id, 10.8, 4)}s`,
        "--drift-delay": `${getMotionDelay(visual.id)}s`,
        "--drift-x": `${getMotionAxis(visual.id, 8)}px`,
        "--drift-y": `${getMotionAxis(visual.id, -10)}px`,
        "--breathe-duration": `${getMotionDuration(visual.id, 4.2, 1.5)}s`,
        "--core-duration": `${getMotionDuration(visual.id, 2.6, 0.8)}s`,
        "--glow-duration": `${getMotionDuration(visual.id, 4.4, 1.4)}s`,
        "--cell-primary": visual.palette.primary,
        "--cell-secondary": visual.palette.secondary,
        "--cell-core": visual.palette.core,
        "--cell-rim": visual.palette.rim,
        "--cell-deep": visual.palette.deep,
        "--cell-glow": visual.palette.glow,
      }}
      aria-label={`Select ${visual.id}, status ${visual.activityLabel}`}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(visual.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(visual.id);
      }}
    >
      <span className="floating-cell__selection" aria-hidden="true">
        <span className="floating-cell__organism">
          <img
            className="floating-cell__texture"
            src={visual.textureSrc}
            alt=""
            draggable="false"
          />
          <span className="floating-cell__membrane" />
          {filaments.map((filament) => (
            <span
              key={filament.rotation}
              className="floating-cell__filament"
              style={{
                "--rotation": `${filament.rotation}deg`,
                "--filament-delay": `${filament.delay}s`,
              }}
            />
          ))}
          <span className="floating-cell__inner-ring" />
          <span className="floating-cell__core" />
          <span className="floating-cell__glow" />
        </span>
      </span>
      <span className="floating-cell__label">
        <strong>{visual.id}</strong>
        <small>{visual.activityLabel}</small>
        {visual.cultivation?.state === "growing" || visual.cultivation?.state === "stimulated" ? (
          <span
            className="floating-cell__progress"
            role="progressbar"
            aria-label={`${visual.id} cultivation`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={visual.cultivation.progress}
          >
            <span style={{ width: `${visual.cultivation.progress}%` }} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function getMotionSeed(value) {
  return Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

function getMotionDelay(value) {
  return Number((-(getMotionSeed(value) % 12) * 0.32).toFixed(2));
}

function getMotionDuration(value, base, range) {
  return Number((base + (getMotionSeed(value) % 10) * (range / 10)).toFixed(1));
}

function getMotionAxis(value, base) {
  return base + (getMotionSeed(value) % 5) - 2;
}
