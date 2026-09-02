import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function CultivationPage({
  heartbeatRun,
  heartbeatStatus,
  heartbeatError,
  heartbeatMessage,
  activeCellCount,
  cultivationStatus,
  onStartCultivation,
  onStopCultivation,
}) {
  const { t } = useUiPreferences();
  const status = cultivationStatus?.status ?? "dormant";
  const isStarting = ["starting", "running", "pending", "accepted"].includes(
    heartbeatStatus,
  ) || status === "starting";
  const isStopping = status === "stopping";
  const isBusy = isStarting || isStopping;
  const isRunning = status === "running";

  return (
    <section className="platform-page">
      <div className="page-heading">
        <div>
          <h1>{t("settings.cultivation")}</h1>
          <p>{t("cultivation.description")}</p>
        </div>
        {isRunning || isStopping ? (
          <button
            type="button"
            className="secondary-button heartbeat-run-button"
            onClick={onStopCultivation}
            disabled={isBusy}
          >
            {isStopping ? (
              <>
                <span className="button-spinner" />
                {t("cultivation.stopping")}
              </>
            ) : (
              t("cultivation.stop")
            )}
          </button>
        ) : (
          <button
            type="button"
            className="primary-button heartbeat-run-button"
            onClick={onStartCultivation}
            disabled={isBusy}
          >
            {isStarting ? (
              <>
                <span className="button-spinner" />
                {t("cultivation.starting")}
              </>
            ) : (
              t("cultivation.start")
            )}
          </button>
        )}
      </div>

      {isStarting && (
        <div className="operation-banner">
          <span className="button-spinner" />
          <span>{t("cultivation.startingMessage")}</span>
        </div>
      )}
      {isStopping && (
        <div className="operation-banner">
          <span className="button-spinner" />
          <span>{t("cultivation.stoppingMessage")}</span>
        </div>
      )}
      {heartbeatMessage && !isBusy && (
        <div className="action-feedback-item success">✓ {heartbeatMessage}</div>
      )}
      {heartbeatError && (
        <div className="action-feedback-item error">✕ {heartbeatError}</div>
      )}

      <div className="heartbeat-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-label">{t("cultivation.status")}</div>
          <div className="dashboard-card-value">
            {translateCultivationStatus(status, t)}
          </div>
          <p>
            {isStopping
              ? t("cultivation.waitingTasks")
              : t("cultivation.currentState")}
          </p>
        </article>
        {(isRunning || isStopping) && (
          <article className="dashboard-card">
            <div className="dashboard-card-label">{t("incubator.activeCells")}</div>
            <div className="dashboard-card-value">
              {cultivationStatus?.activeCells ?? activeCellCount}
            </div>
            <p>{t("cultivation.activeDescription")}</p>
          </article>
        )}
        {isStopping && (
          <article className="dashboard-card">
            <div className="dashboard-card-label">{t("cultivation.runningTasks")}</div>
            <div className="dashboard-card-value">
              {cultivationStatus?.runningTasks ?? 0}
            </div>
            <p>
              {formatActiveTicks(cultivationStatus?.activeTickCellIds, t)}
            </p>
          </article>
        )}
        <article className="dashboard-card">
          <div className="dashboard-card-label">{t("cultivation.lastStart")}</div>
          <div className="dashboard-card-value">
            {heartbeatRun?.status ? translateCultivationStatus(heartbeatRun.status, t) : t("cultivation.notStarted")}
          </div>
          <p>{t("cultivation.latestStatus")}</p>
        </article>
      </div>

      <div className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <h3>{t("cultivation.result")}</h3>
            <p>{t("cultivation.resultDescription")}</p>
          </div>
        </div>
        <pre className="heartbeat-result">
          {heartbeatRun
            ? JSON.stringify(heartbeatRun, null, 2)
            : t("cultivation.noResult")}
        </pre>
      </div>
    </section>
  );
}

function translateCultivationStatus(value, t) {
  const normalized = String(value ?? "dormant").toLowerCase();
  const key = {
    dormant: "cultivation.dormant",
    starting: "cultivation.startingState",
    running: "cultivation.running",
    stopping: "cultivation.stoppingState",
    pending: "cell.stagePending",
    accepted: "incubator.phaseAccepted",
    completed: "cultivation.completed",
    failed: "cultivation.failed",
  }[normalized];
  return key ? t(key) : normalized;
}

function formatActiveTicks(cellIds = [], t) {
  if (cellIds.length === 0) {
    return t("cultivation.noRunningTasks");
  }

  if (cellIds.length === 1) {
    return t("cultivation.waitingCell", { cell: cellIds[0] });
  }

  return t("cultivation.waitingCells", { count: cellIds.length });
}
