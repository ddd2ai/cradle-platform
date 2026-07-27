export function CultivateButton({ isRunning, onClick }) {
  return (
    <button
      type="button"
      className="cultivate-button"
      disabled={isRunning}
      aria-busy={isRunning}
      onClick={onClick}
    >
      <span className="cultivate-button__icon" aria-hidden="true">
        {isRunning ? "◌" : "♡"}
      </span>
      <strong>{isRunning ? "Cultivating..." : "Cultivate"}</strong>
      <small>Run One Cycle</small>
    </button>
  );
}
