export function DockAction({
  icon,
  label,
  disabled = false,
  title,
  onClick,
}) {
  return (
    <button
      type="button"
      className="cradle-dock-item"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="cradle-dock-item__icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
