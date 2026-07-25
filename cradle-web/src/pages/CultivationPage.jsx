export function CultivationPage({
  heartbeatRun,
  heartbeatStatus,
  heartbeatError,
  heartbeatMessage,
  activeCellCount,
  cultivationStatus,
  onStartCultivation,
  onStopCultivation,
}) {
  const status = cultivationStatus?.status ?? "dormant";
  const isStarting = ["starting", "running", "pending", "accepted"].includes(
    heartbeatStatus,
  ) || status === "starting";
  const isStopping = status === "stopping";
  const isBusy = isStarting || isStopping;
  const isRunning = status === "running";

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
        {isRunning || isStopping ? (
          <button
            type="button"
            className="secondary-button heartbeat-run-button"
            onClick={onStopCultivation}
            disabled={isBusy}
          >
            {isStopping ? (
              <>
                <span className="button-spinner" />
                Stopping Cultivation...
              </>
            ) : (
              "Stop Cultivation"
            )}
          </button>
        ) : (
          <button
            type="button"
            className="primary-button heartbeat-run-button"
            onClick={onStartCultivation}
            disabled={isBusy}
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
        )}
      </div>

      {isStarting && (
        <div className="operation-banner">
          <span className="button-spinner" />
          <span>Cradle cultivation is starting.</span>
        </div>
      )}
      {isStopping && (
        <div className="operation-banner">
          <span className="button-spinner" />
          <span>Cradle cultivation is stopping.</span>
        </div>
      )}
      {heartbeatMessage && !isBusy && (
        <div className="action-feedback-item success">✓ {heartbeatMessage}</div>
      )}
      {heartbeatError && (
        <div className="action-feedback-item error">✕ {heartbeatError}</div>
      )}

      <div className="heartbeat-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-label">Cultivation Status</div>
          <div className="dashboard-card-value">
            {toTitleCase(status)}
          </div>
          <p>
            {isStopping
              ? "Waiting for running cell tasks to finish."
              : "Current state of the Cradle cultivation loop."}
          </p>
        </article>
        {(isRunning || isStopping) && (
          <article className="dashboard-card">
            <div className="dashboard-card-label">Active Cells</div>
            <div className="dashboard-card-value">
              {cultivationStatus?.activeCells ?? activeCellCount}
            </div>
            <p>Cells currently available for cultivation ticks.</p>
          </article>
        )}
        {isStopping && (
          <article className="dashboard-card">
            <div className="dashboard-card-label">Running Tasks</div>
            <div className="dashboard-card-value">
              {cultivationStatus?.runningTasks ?? 0}
            </div>
            <p>
              {formatActiveTicks(cultivationStatus?.activeTickCellIds)}
            </p>
          </article>
        )}
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

function toTitleCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "Dormant";
}

function formatActiveTicks(cellIds = []) {
  if (cellIds.length === 0) {
    return "No running cell tasks remain.";
  }

  if (cellIds.length === 1) {
    return `Waiting for ${cellIds[0]} to finish its current task.`;
  }

  return `Waiting for ${cellIds.length} cells to finish current tasks.`;
}
