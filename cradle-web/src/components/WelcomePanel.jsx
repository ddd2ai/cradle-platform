export function WelcomePanel({ onCreateCell }) {
  return (
    <section className="welcome-panel">
      <div className="welcome-content">
        <div className="cradle-symbol">🧬</div>
        <h2>Grow software as a living system</h2>
        <p>
          Create, observe and evolve software cells through the Cradle platform.
        </p>
        <button type="button" className="primary-button" onClick={onCreateCell}>
          Create New Cell
        </button>
      </div>
    </section>
  );
}
