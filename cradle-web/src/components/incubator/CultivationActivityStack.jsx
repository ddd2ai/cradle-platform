import { CultivationProgressCard } from "./CultivationProgressCard";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function CultivationActivityStack({
  items = [],
  selectedCell,
  onCancel,
  onDismiss,
  onRetry,
}) {
  const { t } = useUiPreferences();
  if (items.length === 0) return null;

  return (
    <section
      className="cultivation-activity-stack"
      aria-label={t("incubator.feedActivity")}
    >
      <div className="cultivation-activity-stack__rail" aria-hidden="true" />
      {items.map((item) => item.operation ? (
        <CultivationProgressCard
          key={item.feedId}
          operationId={item.operation.operationId}
          acceptedOperation={item.operation}
          selectedCell={selectedCell}
          actionError={item.actionError}
          onCancel={() => onCancel(item.feedId)}
          onDismiss={() => onDismiss(item.feedId)}
        />
      ) : (
        <LocalFeedCard
          key={item.feedId}
          item={item}
          onDismiss={() => onDismiss(item.feedId)}
          onCancel={() => onCancel(item.feedId)}
          onRetry={() => onRetry(item.feedId)}
          t={t}
        />
      ))}
    </section>
  );
}

function LocalFeedCard({ item, onCancel, onDismiss, onRetry, t }) {
  const failed = item.state === "failed";
  const cancelled = item.state === "cancelled";
  const queued = item.state === "queued";
  const label = failed
    ? t("incubator.feedFailed")
    : cancelled
      ? t("status.cancelled")
    : queued
      ? t("incubator.feedQueued", { position: item.queuePosition })
      : t("incubator.feedEntering");

  return (
    <article className={`cultivation-progress cultivation-progress--${failed ? "attention" : cancelled ? "cancelled" : "local"}`}>
      <div className="cultivation-progress__heading">
        <strong title={item.sourceName}>{item.sourceName}</strong>
        <span>{failed ? "⚠" : cancelled ? "×" : queued ? "◌" : "↗"} {label}</span>
      </div>
      <p className="cultivation-progress__terminal-message">
        {failed ? item.error : cancelled ? t("incubator.cancelledBeforeUpload") : t("incubator.feedLocalHint")}
      </p>
      {failed ? (
        <div className="cultivation-progress__actions">
          <button type="button" onClick={onRetry}>{t("common.retry")}</button>
          <button type="button" onClick={onDismiss}>{t("common.close")}</button>
        </div>
      ) : queued ? (
        <div className="cultivation-progress__actions">
          <button type="button" onClick={onCancel}>{t("common.cancel")}</button>
        </div>
      ) : cancelled ? (
        <div className="cultivation-progress__actions">
          <button type="button" onClick={onDismiss}>{t("common.close")}</button>
        </div>
      ) : null}
    </article>
  );
}
