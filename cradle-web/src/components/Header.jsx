export function Header({ selectedCell, isServerConnected }) {
  return (
    <header className="top-bar">
      <div className="top-bar-title">
        <h1>{selectedCell ? selectedCell.name : "Cradle"}</h1>
        <p>
          {selectedCell ? selectedCell.id : "Software Life Engineering Platform"}
        </p>
      </div>

      <div className="top-bar-actions">
        <div className={`server-status ${isServerConnected ? "connected" : "disconnected"}`}>
          <span className="server-status-dot" />
          <span>{isServerConnected ? "Server connected" : "Server disconnected"}</span>
        </div>
        <button type="button" className="icon-button" aria-label="More options">
          ⋯
        </button>
      </div>
    </header>
  );
}
