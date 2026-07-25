export function CultivationPage({
  heartbeatRun,
  heartbeatStatus,
  heartbeatError,
  heartbeatMessage,
  cultivationRunning,
  onStartCultivation,
}) {
  const isStarting = ["starting", "running", "pending", "accepted"].includes(
    heartbeatStatus,
  );

  return (
    <section className="platform-page">
      <div className="page-heading">
        <div>
          <h1>Cultivation</h1>
          <p>
            Activate the Cradle and allow active cells to tick,
            observe and evolve.
          </p>
        </div>
        <button
          type="button"
          className="primary-button heartbeat-run-button"
          onClick={onStartCultivation}
          disabled={isStarting}
        >
          {isStarting ? (
            <>
              <span className="button-spinner" />
              Starting Cultivation...
            </>
          ) : (
            "Start Cultivation"
          )}
        </button>
      </div>

      {isStarting && (
        <div className="operation-banner">
          <span className="button-spinner" />
          <span>Cradle cultivation is starting.</span>
        </div>
      )}
      {heartbeatMessage && !isStarting && (
        <div className="action-feedback-item success">✓ {heartbeatMessage}</div>
      )}
      {heartbeatError && (
        <div className="action-feedback-item error">✕ {heartbeatError}</div>
      )}

      <div className="heartbeat-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-label">Cultivation Status</div>
          <div className="dashboard-card-value">
            {cultivationRunning ? "Running" : "Dormant"}
          </div>
          <p>Current state of the Cradle cultivation loop.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">Last Start Command</div>
          <div className="dashboard-card-value">
            {heartbeatRun?.status ?? "Not started"}
          </div>
          <p>Status of the latest heartbeat operation.</p>
        </article>
      </div>

      <div className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <h3>Heartbeat Operation Result</h3>
            <p>Latest heartbeat API response for the cultivation start command.</p>
          </div>
        </div>
        <pre className="heartbeat-result">
          {heartbeatRun
            ? JSON.stringify(heartbeatRun, null, 2)
            : "No heartbeat operation result available."}
        </pre>
      </div>
    </section>
  );
}
