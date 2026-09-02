import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function CultivateButton({ isRunning, onClick }) {
  const { t } = useUiPreferences();
  return (
    <button
      type="button"
      className="cultivate-button"
      disabled={isRunning}
      aria-busy={isRunning}
      onClick={onClick}
    >
      <strong>{t(isRunning ? "incubator.cultivating" : "incubator.cultivate")}</strong>
    </button>
  );
}
