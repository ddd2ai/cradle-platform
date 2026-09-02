import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function EnvironmentOverlayCard({ environment }) {
  const { t } = useUiPreferences();
  const status = environment.status ?? "unknown";

  return (
    <section
      className={`environment-overlay-card is-${status}`}
      aria-label={t("environment.cellEnvironment")}
    >
      <header className="environment-overlay-card__header">
        <div>
          <span className="environment-overlay-card__eyebrow">{t("foundation.environment")}</span>
          <strong>
            <span className="environment-overlay-card__status-dot" aria-hidden="true" />
            {formatLabel(status, t)}
          </strong>
        </div>
        <span aria-hidden="true">⌄</span>
      </header>

      <dl className="environment-overlay-card__readings">
        <EnvironmentReading
          label={t("environment.requirements")}
          value={environment.requirementsLoaded ? t("environment.loaded") : "--"}
          healthy={environment.requirementsLoaded}
        />
        <EnvironmentReading label={t("creations.runtime")} value={environment.runtime} />
        <EnvironmentReading label={t("environment.framework")} value={environment.framework} />
        <EnvironmentReading label={t("environment.architecture")} value={environment.architecture} />
        <EnvironmentReading
          label={t("workspace.workspace")}
          value={environment.workspacePrepared ? t("environment.prepared") : "--"}
          healthy={environment.workspacePrepared}
        />
      </dl>
    </section>
  );
}

function EnvironmentReading({ label, value, healthy = false }) {
  return (
    <div className="environment-overlay-card__reading">
      <dt>{label}</dt>
      <dd>
        {healthy && <span className="environment-overlay-card__reading-dot" aria-hidden="true" />}
        {value ?? "--"}
      </dd>
    </div>
  );
}

function formatLabel(value, t) {
  const key = ({ healthy: "status.healthy", active: "status.active", ready: "environment.ready", unknown: "status.unknown" })[value];
  if (key) return t(key);
  return value.charAt(0).toUpperCase() + value.slice(1);
}
