const cradleItems = [
  { id: "overview", label: "Overview" },
  { id: "incubator", label: "Incubator" },
  { id: "opendna", label: "Observatory" },
  { id: "artifacts", label: "Artifacts" },
  { id: "logs", label: "Logs" },
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
                <NavIcon id={item.id} />
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
                <span className={`cell-icon cell-icon--${cellTone(cell)}`} aria-hidden="true">
                  <img src={`/cells/cell-${cellTone(cell)}.webp`} alt="" />
                </span>
                <span className="cell-info">
                  <span className="cell-name">{cell.name}</span>
                  <span className="cell-meta">
                    <span className={`status-dot status-${cell.status}`} />
                    <span>{cellActivity(cell)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-footer-button ${
            selectedSection === "settings" ? "selected" : ""
          }`}
          onClick={() => onSelectSection("settings")}
        >
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

function NavIcon({ id }) {
  const paths = {
    overview: (
      <>
        <path d="M4 10.5 10 5l6 5.5V17a2 2 0 0 1-2 2h-2v-5H8v5H6a2 2 0 0 1-2-2Z" />
        <path d="M7 6.5V4h2" />
      </>
    ),
    incubator: <path d="M10 19S3 14.2 3 8.8A4 4 0 0 1 10 6a4 4 0 0 1 7 2.8C17 14.2 10 19 10 19Z" />,
    opendna: (
      <>
        <path d="M3.5 10s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z" />
        <path d="M10 8.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8ZM5.5 4.5l1.6 1.6M14.5 4.5l-1.6 1.6M10 3.5v2" />
      </>
    ),
    artifacts: (
      <>
        <path d="m10 3 7 4v8l-7 4-7-4V7Z" />
        <path d="m3 7 7 4 7-4M10 11v8M7 5.2l7 4" />
      </>
    ),
    logs: (
      <>
        <path d="M7 4h9v14H7M3 6h4M3 10h4M3 14h4" />
      </>
    ),
  };

  return (
    <span className="cradle-nav-icon" aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        {paths[id]}
      </svg>
    </span>
  );
}

function cellActivity(cell) {
  const status = String(cell.status ?? "").toLowerCase();

  if (cell.active === true || ["active", "running"].includes(status)) {
    return "Healthy";
  }

  if (["repairing", "processing"].includes(status)) {
    return "Evolving";
  }

  return status ? status[0].toUpperCase() + status.slice(1) : "Idle";
}

function cellTone(cell) {
  const id = String(cell.id ?? "");

  if (/^b0?1$/i.test(id)) return "green";

  const numberedCell = id.match(/^cell-(\d+)$/i);

  if (numberedCell) {
    const tones = ["purple", "cyan", "blue", "amber"];
    return tones[(Number(numberedCell[1]) - 1) % tones.length];
  }

  const tones = ["green", "purple", "cyan", "blue", "amber"];
  const source = String(cell.id ?? cell.name ?? "");
  const hash = [...source].reduce((total, character) => total + character.charCodeAt(0), 0);
  return tones[hash % tones.length];
}
