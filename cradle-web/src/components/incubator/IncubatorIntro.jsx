import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function IncubatorIntro() {
  const { t } = useUiPreferences();
  return (
    <div className="incubator-intro">
      <p className="incubator-intro__index">CRADLE / {t("incubator.liveCulture")}</p>
      <h2>{t("nav.incubator")}</h2>
      <p>{t("incubator.intro")}</p>
    </div>
  );
}
