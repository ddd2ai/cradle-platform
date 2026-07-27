export function CellControlCard({
  cell,
  visual,
  activeAction,
  message,
  error,
  onActivate,
  onDeactivate,
}) {
  const status = String(cell.status ?? "").toLowerCase();
  const isActive = cell.active === true || ["active", "running"].includes(status);
  const isIdle = cell.active === false || ["idle", "inactive"].includes(status);
  const isBusy = Boolean(activeAction);

  return (
    <article className="selected-cell-card cell-control-card">
      <div className="cell-control-card__header">
        <span
          className="cell-control-card__specimen"
          style={{ "--cell-primary": visual.palette.primary }}
          aria-hidden="true"
        >
          <img src={visual.textureSrc} alt="" />
        </span>
        <div className="cell-control-card__name">
          <strong>{visual.id}</strong>
          <span className="cell-control-card__health">
            <i aria-hidden="true" />
            {visual.activityLabel}
          </span>
        </div>
        <span className={`incubator-status-badge status-${status || "unknown"}`}>
          <i />
          {status || "unknown"}
        </span>
      </div>

      <div className="cell-control-card__actions">
        <button
          type="button"
          onClick={onActivate}
          disabled={isBusy || isActive}
        >
          {activeAction === "activate" && <span className="button-spinner" />}
          {activeAction === "activate" ? "Activating" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          disabled={isBusy || isIdle}
        >
          {activeAction === "deactivate" && <span className="button-spinner" />}
          {activeAction === "deactivate" ? "Deactivating" : "Deactivate"}
        </button>
      </div>

      <div className="cell-control-card__feedback" aria-live="polite">
        {!activeAction && message && <span className="is-success">{message}</span>}
        {!activeAction && error && <span className="is-error">{error}</span>}
      </div>
    </article>
  );
}
