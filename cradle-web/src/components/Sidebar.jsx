import { useUiPreferences } from "../i18n/UiPreferencesProvider";

const cradleItems = [
  { id: "overview", labelKey: "nav.foundation" },
  { id: "incubator", labelKey: "nav.incubator" },
  { id: "opendna", labelKey: "nav.observatory" },
  { id: "artifacts", labelKey: "nav.creations" },
  { id: "logs", labelKey: "nav.logs" },
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
  const { t } = useUiPreferences();
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button type="button" className="new-cell-button" onClick={onCreateCell}>
          <span className="new-cell-icon">＋</span>
          <span>{t("nav.newCell")}</span>
        </button>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section-title">{t("nav.cradle")}</div>
        <nav className="cradle-nav" aria-label={t("nav.cradleFunctions")}>
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
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-section-title">{t("nav.cells")}</div>
        <div className="cell-list">
          {isLoading && <div className="sidebar-message">{t("nav.loadingCells")}</div>}
          {!isLoading && error && (
            <div className="sidebar-message error">
              {t("nav.serverUnavailable")}
            </div>
          )}
          {!isLoading && !error && cells.length === 0 && (
            <div className="sidebar-message">{t("nav.noCells")}</div>
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
                    <span>{cellActivity(cell, t)}</span>
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
          <span>{t("nav.settings")}</span>
        </button>
        <div className="platform-version">
          Cradle Platform
          <span>v1.0.0</span>
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

function cellActivity(cell, t) {
  const cultivationState = String(cell.cultivation?.state ?? "").toLowerCase();
  if (["stimulated", "growing"].includes(cultivationState)) {
    return t("status.growingPercent", { percent: Math.round(Number(cell.cultivation?.progress) || 0) });
  }
  if (cultivationState === "stable") return t("status.stable");
  if (cultivationState === "needs_attention") return t("status.needsAttention");

  const status = String(cell.status ?? "").toLowerCase();

  if (cell.active === true || ["active", "running"].includes(status)) {
    return t("status.healthy");
  }

  if (["repairing", "processing"].includes(status)) {
    return t("status.evolving");
  }

  if (!status) return t("status.idle");
  const knownStatus = ["active", "idle"].includes(status) ? `status.${status}` : null;
  return knownStatus ? t(knownStatus) : status[0].toUpperCase() + status.slice(1);
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
