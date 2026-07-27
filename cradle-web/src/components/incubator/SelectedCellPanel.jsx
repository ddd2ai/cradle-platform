import { DnaDimensionsCard } from "../cell/DnaDimensionsCard";
import { LifecycleCard } from "../cell/LifecycleCard";
import { MaturityCard } from "../cell/MaturityCard";
import { CellControlCard } from "./CellControlCard";

export function SelectedCellPanel({
  cell,
  visual,
  isLoading,
  error,
  activeAction,
  actionMessage,
  actionError,
  onActivate,
  onDeactivate,
}) {
  if (isLoading && !cell) {
    return (
      <aside className="selected-cell-panel" aria-label="Selected Cell details">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="selected-cell-card incubator-card-skeleton">
            <span />
            <span />
            <span />
          </div>
        ))}
      </aside>
    );
  }

  if (!cell || !visual) {
    return (
      <aside className="selected-cell-panel" aria-label="Selected Cell details">
        <div className="selected-cell-card selected-cell-panel__empty">
          <span aria-hidden="true">◎</span>
          <strong>No Cell selected</strong>
          <p>Select a living Cell in the dish to inspect it.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="selected-cell-panel" aria-label={`Details for ${visual.id}`}>
      {error && (
        <div className="selected-cell-panel__notice">
          Some Cell details could not be loaded.
        </div>
      )}
      <CellControlCard
        cell={cell}
        visual={visual}
        activeAction={activeAction}
        message={actionMessage}
        error={actionError}
        onActivate={onActivate}
        onDeactivate={onDeactivate}
      />
      <LifecycleCard lifecycle={visual.lifecycleInfo} />
      <MaturityCard maturity={visual.maturityInfo} />
      <DnaDimensionsCard dimensions={visual.dimensions} />
    </aside>
  );
}
