export function CradleOverviewPage({ cells }) {
  const activeCount = cells.filter((cell) => {
    const status = String(cell.status ?? "").toLowerCase();
    return status === "active" || status === "running";
  }).length;

  const idleCount = cells.filter((cell) => {
    const status = String(cell.status ?? "").toLowerCase();
    return status === "idle" || status === "inactive";
  }).length;

  return (
    <section className="platform-page">
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p>Observe the overall state of the software life environment.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-label">Total Cells</div>
          <div className="dashboard-card-value">{cells.length}</div>
          <p>Cells currently living in this Cradle.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">Active Cells</div>
          <div className="dashboard-card-value">{activeCount}</div>
          <p>Cells currently active or running.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">Idle Cells</div>
          <div className="dashboard-card-value">{idleCount}</div>
          <p>Cells currently inactive or idle.</p>
        </article>
      </div>

      <div className="workspace-card cradle-summary-card">
        <div className="workspace-card-header">
          <div>
            <h3>Cradle Environment</h3>
            <p>Platform-level status and cultivation controls.</p>
          </div>
        </div>
        <div className="overview-placeholder">
          Heartbeat, Observatory, artifacts and runtime activity will appear here.
        </div>
      </div>
    </section>
  );
}
