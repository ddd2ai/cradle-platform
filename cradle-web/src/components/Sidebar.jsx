const cradleItems = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "cultivation", label: "Cultivation", icon: "♡" },
  { id: "opendna", label: "OpenDNA", icon: "🧬" },
  { id: "artifacts", label: "Artifacts", icon: "◈" },
  { id: "logs", label: "Logs", icon: "≡" },
];

export function Sidebar({
  cells,
  selectedCellId,
  selectedSection,
  onSelectCell,
  onSelectSection,
  onCreateCell,
  isLoading,
  error,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button type="button" className="new-cell-button" onClick={onCreateCell}>
          <span className="new-cell-icon">＋</span>
          <span>New Cell</span>
        </button>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section-title">Cradle</div>
        <nav className="cradle-nav" aria-label="Cradle functions">
          {cradleItems.map((item) => {
            const isSelected = selectedSection === item.id;

            return (
              <button
                type="button"
                key={item.id}
                className={`cradle-nav-item ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectSection(item.id)}
              >
                <span className="cradle-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-section-title">Cells</div>
        <div className="cell-list">
          {isLoading && <div className="sidebar-message">Loading cells...</div>}
          {!isLoading && error && (
            <div className="sidebar-message error">
              Unable to connect to Cradle Server
            </div>
          )}
          {!isLoading && !error && cells.length === 0 && (
            <div className="sidebar-message">No cells found</div>
          )}
          {!isLoading && !error && cells.map((cell) => {
            const isSelected = cell.id === selectedCellId;

            return (
              <button
                type="button"
                key={cell.id}
                className={`cell-item ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectCell(cell.id)}
              >
                <span className="cell-icon">🦠</span>
                <span className="cell-info">
                  <span className="cell-name">{cell.name}</span>
                  <span className="cell-meta">
                    <span className={`status-dot status-${cell.status}`} />
                    <span>{cell.id}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-footer-button">
          <span>⚙️</span>
          <span>Settings</span>
        </button>
        <div className="platform-version">
          Cradle Platform
          <span>v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
