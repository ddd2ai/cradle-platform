import { toCellViewModel } from "../domain/cellViewModel";

export function CellPanel({ cell }) {
  const view = toCellViewModel(cell);
  const maturityText =
    typeof view.maturity === "number"
      ? `${Math.round(view.maturity <= 1 ? view.maturity * 100 : view.maturity)}%`
      : "—";
  const workspaceSectionCount = Object.keys(view.workspaceSections).length;

  return (
    <section className="cell-panel">
      <div className="cell-overview-card">
        <div className="cell-overview-header">
          <div className="cell-large-icon">🦠</div>
          <div className="cell-overview-title">
            <h2>{view.name}</h2>
            <p>{view.id}</p>
          </div>
          <div className={`cell-status-badge status-${view.status}`}>
            {view.status}
          </div>
        </div>

        <div className="cell-actions">
          <button type="button" className="secondary-button">Activate</button>
          <button type="button" className="secondary-button">Deactivate</button>
          <button type="button" className="secondary-button">Heartbeat</button>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-label">Lifecycle</div>
          <div className="dashboard-card-value">{view.lifecycle}</div>
          <p>Current software life-cycle state.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">Maturity</div>
          <div className="dashboard-card-value">{maturityText}</div>
          <p>Estimated maturity of the selected cell.</p>
        </article>
        <article className="dashboard-card">
          <div className="dashboard-card-label">DNA Dimensions</div>
          <div className="dashboard-card-value">{view.dnaDimensions ?? "—"}</div>
          <p>Active DNA traits currently being observed.</p>
        </article>
      </div>

      <div className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <h3>Cell Workspace</h3>
            <p>
              {view.workspacePath ??
                `${workspaceSectionCount} workspace sections available.`}
            </p>
          </div>
          <button type="button" className="text-button">Open Workspace</button>
        </div>
        <div className="workspace-placeholder">
          {view.workspacePath ??
            (workspaceSectionCount > 0
              ? Object.entries(view.workspaceSections)
                  .map(([name, entries]) => `${name}: ${entries.length}`)
                  .join(" · ")
              : "Workspace information will appear here.")}
        </div>
      </div>
    </section>
  );
}
