import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function WelcomePanel({ onCreateCell }) {
  const { t } = useUiPreferences();
  return (
    <section className="welcome-panel">
      <div className="welcome-content">
        <div className="cradle-symbol">🧬</div>
        <h2>{t("welcome.title")}</h2>
        <p>{t("welcome.description")}</p>
        <button type="button" className="primary-button" onClick={onCreateCell}>
          {t("cell.create")}
        </button>
      </div>
    </section>
  );
}
