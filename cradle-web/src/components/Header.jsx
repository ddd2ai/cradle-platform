export function Header({ selectedCell, selectedSection, isServerConnected }) {
  const sectionTitles = {
    overview: {
      title: "Cradle",
      subtitle: "Software Life Engineering Platform",
    },
    incubator: {
      title: "Incubator",
      subtitle: "Observe and nurture the living cells in Cradle.",
    },
    cultivation: {
      title: "Cultivation",
      subtitle: "Activate and observe the Cradle environment",
    },
    opendna: {
      title: "Observatory",
      subtitle: "Observe cell traits, relationships, and evolution.",
    },
    artifacts: { title: "Artifacts", subtitle: "Generated software products" },
    logs: { title: "Logs", subtitle: "Cradle runtime activity" },
    settings: {
      title: "Settings",
      subtitle: "Configure Cradle runtime and system behavior.",
    },
  };
  const section = sectionTitles[selectedSection] ?? sectionTitles.overview;
  const title =
    selectedSection === "cell" && selectedCell
      ? selectedCell.name ?? selectedCell.id
      : section.title;
  const subtitle =
    selectedSection === "cell" && selectedCell
      ? selectedCell.id
      : section.subtitle;

  return (
    <header className="top-bar">
      <div className="top-bar-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
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
