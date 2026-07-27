export function EnvironmentOverlayCard({ environment }) {
  const status = environment.status ?? "unknown";

  return (
    <section
      className={`environment-overlay-card is-${status}`}
      aria-label="Cell environment"
    >
      <header className="environment-overlay-card__header">
        <div>
          <span className="environment-overlay-card__eyebrow">Environment</span>
          <strong>
            <span className="environment-overlay-card__status-dot" aria-hidden="true" />
            {formatLabel(status)}
          </strong>
        </div>
        <span aria-hidden="true">⌄</span>
      </header>

      <dl className="environment-overlay-card__readings">
        <EnvironmentReading
          label="Requirements"
          value={environment.requirementsLoaded ? "Loaded" : "--"}
          healthy={environment.requirementsLoaded}
        />
        <EnvironmentReading label="Runtime" value={environment.runtime} />
        <EnvironmentReading label="Framework" value={environment.framework} />
        <EnvironmentReading label="Architecture" value={environment.architecture} />
        <EnvironmentReading
          label="Workspace"
          value={environment.workspacePrepared ? "Prepared" : "--"}
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

function formatLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
