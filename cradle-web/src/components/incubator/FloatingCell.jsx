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
  layout,
  primary,
  selected,
  dimmed,
  focused,
  onSelect,
}) {
  const className = [
    "floating-cell",
    primary ? "is-primary" : "",
    selected ? "is-selected" : "",
    dimmed ? "is-dimmed" : "",
    focused && selected ? "is-focus-target" : "",
  ].filter(Boolean).join(" ");
  const filaments = primary ? PRIMARY_FILAMENTS : FILAMENTS;

  return (
    <button
      type="button"
      className={className}
      data-cell-id={visual.id}
      style={{
        "--cell-x": `${layout.x}%`,
        "--cell-y": `${layout.y}%`,
        "--cell-size": `${layout.size}px`,
        "--drift-duration": `${layout.driftDuration}s`,
        "--drift-delay": `${layout.delay}s`,
        "--drift-x": `${layout.driftX}px`,
        "--drift-y": `${layout.driftY}px`,
        "--breathe-duration": `${layout.breatheDuration}s`,
        "--core-duration": `${layout.coreDuration}s`,
        "--glow-duration": `${layout.glowDuration}s`,
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
      </span>
    </button>
  );
}
