export function CultivateButton({ isRunning, onClick }) {
  return (
    <button
      type="button"
      className="cultivate-button"
      disabled={isRunning}
      aria-busy={isRunning}
      onClick={onClick}
    >
      <strong>{isRunning ? "Cultivating..." : "Cultivate"}</strong>
    </button>
  );
}
