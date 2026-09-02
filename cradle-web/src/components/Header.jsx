import { useEffect, useRef, useState } from "react";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

const LANGUAGES = [
  { id: "en", flag: "🇺🇸", labelKey: "language.en" },
  { id: "zh-TW", flag: "🇹🇼", labelKey: "language.zhTW" },
  { id: "ja", flag: "🇯🇵", labelKey: "language.ja" },
  { id: "ko", flag: "🇰🇷", labelKey: "language.ko" },
  { id: "th", flag: "🇹🇭", labelKey: "language.th" },
];

const THEMES = [
  { id: "dark", icon: "◐", labelKey: "theme.dark", descriptionKey: "theme.description.dark" },
  { id: "glass", icon: "◇", labelKey: "theme.glass", descriptionKey: "theme.description.glass" },
];

export function Header({ selectedCell, selectedSection, isServerConnected }) {
  const { locale, theme, setLocale, setTheme, t } = useUiPreferences();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const sectionTitles = {
    overview: { title: t("nav.foundation"), subtitle: t("header.foundation") },
    incubator: { title: t("nav.incubator"), subtitle: t("header.incubator") },
    cultivation: { title: t("settings.cultivation"), subtitle: t("header.cultivation") },
    opendna: { title: t("nav.observatory"), subtitle: t("header.observatory") },
    artifacts: { title: t("nav.creations"), subtitle: t("header.creations") },
    logs: { title: t("nav.logs"), subtitle: t("header.logs") },
    settings: { title: t("nav.settings"), subtitle: t("header.settings") },
  };
  const section = sectionTitles[selectedSection] ?? sectionTitles.overview;
  const title = selectedSection === "cell" && selectedCell
    ? selectedCell.name ?? selectedCell.id
    : section.title;
  const subtitle = selectedSection === "cell" && selectedCell
    ? selectedCell.id
    : section.subtitle;

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="top-bar">
      <div className="top-bar-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="top-bar-actions">
        <div className={`server-status ${isServerConnected ? "connected" : "disconnected"}`}>
          <span className="server-status-dot" />
          <span>{t(isServerConnected ? "server.connected" : "server.disconnected")}</span>
        </div>
        <div className="preferences-anchor" ref={menuRef}>
          <button
            type="button"
            className={`icon-button ${isMenuOpen ? "selected" : ""}`}
            aria-label={t("menu.more")}
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {isMenuOpen && (
            <section className="preferences-popover" role="dialog" aria-label={t("menu.preferences")}>
              <header className="preferences-popover-header">
                <h2>{t("menu.preferences")}</h2>
              </header>

              <section className="preference-group">
                <h3>{t("menu.language")}</h3>
                <div className="language-options" role="radiogroup" aria-label={t("menu.language")}>
                  {LANGUAGES.map((language) => (
                    <button
                      type="button"
                      key={language.id}
                      className={`preference-option ${locale === language.id ? "is-selected" : ""}`}
                      role="radio"
                      aria-checked={locale === language.id}
                      onClick={() => setLocale(language.id)}
                    >
                      <span className="language-flag" aria-hidden="true">{language.flag}</span>
                      <span className="preference-option__label">{t(language.labelKey)}</span>
                      <i className="preference-option__indicator" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>

              <section className="preference-group">
                <h3>{t("menu.theme")}</h3>
                <div className="theme-options" role="radiogroup" aria-label={t("menu.theme")}>
                  {THEMES.map((themeOption) => (
                    <button
                      type="button"
                      key={themeOption.id}
                      className={`preference-option ${theme === themeOption.id ? "is-selected" : ""}`}
                      role="radio"
                      aria-checked={theme === themeOption.id}
                      onClick={() => setTheme(themeOption.id)}
                    >
                      <span className={`theme-preview theme-preview--${themeOption.id}`} aria-hidden="true">{themeOption.icon}</span>
                      <span className="preference-option__copy"><strong>{t(themeOption.labelKey)}</strong><small>{t(themeOption.descriptionKey)}</small></span>
                      <i className="preference-option__indicator" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            </section>
          )}
        </div>
      </div>
    </header>
  );
}
