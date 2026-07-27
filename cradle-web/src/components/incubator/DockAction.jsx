export function DockAction({
  icon,
  label,
  disabled = false,
  title,
  onClick,
  buttonRef,
}) {
  return (
    <span
      className="cradle-dock-action-shell"
      title={disabled ? title : undefined}
    >
      <button
        type="button"
        className="cradle-dock-item"
        ref={buttonRef}
        disabled={disabled}
        title={disabled ? undefined : title}
        onClick={onClick}
      >
        <span className="cradle-dock-item__icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </button>
    </span>
  );
}
