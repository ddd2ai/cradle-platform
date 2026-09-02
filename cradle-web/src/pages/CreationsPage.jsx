import { startTransition, useEffect, useMemo, useState } from "react";
import { getArtifactDownloadUrl, getCreations } from "../features/creations/api";
import { subscribeToCradleEvents } from "../services/cradle-event-stream";
import {
  registerResourceLoader,
  invalidateResource,
} from "../services/resource-invalidation";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function CreationsPage({
  onOpenWorkspace,
  initialCreations = [],
  skipInitialLoad = false,
} = {}) {
  const { t } = useUiPreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const [creations, setCreations] = useState(initialCreations);
  const [isLoading, setIsLoading] = useState(!skipInitialLoad);
  const [error, setError] = useState(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (skipInitialLoad) {
      return undefined;
    }

    let cancelled = false;

    async function loadCreations() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await getCreations();

        if (!cancelled) {
          startTransition(() => setCreations(result));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("creations.loadError"),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCreations();

    // 註冊 artifacts resource loader
    const unregisterArtifacts = registerResourceLoader("artifacts", async () => {
      if (!cancelled) {
        await loadCreations();
      }
    });

    const unsubscribe = subscribeToCradleEvents((event) => {
      if (event.type === "artifacts.updated" && !event.payload.operationId) {
        invalidateResource("artifacts");
      }
    });

    return () => {
      cancelled = true;
      unregisterArtifacts();
      unsubscribe();
    };
  }, [skipInitialLoad, t]);

  const visibleCreations = useMemo(() => {
    if (!normalizedQuery) {
      return creations;
    }

    return creations.filter((creation) => {
      const searchableText = [
        creation.title,
        creation.originCellId,
        creation.artifactId,
        creation.status,
        creation.stage,
        creation.description,
        creation.planSummary,
        creation.summary,
        creation.goal,
        creation.provider,
        creation.model,
        ...creation.tags,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [creations, normalizedQuery]);

  function handleRetry() {
    setIsLoading(true);
    setError(null);

    getCreations()
      .then((result) => {
        setCreations(result);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("creations.loadError"),
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <section className="platform-page creations-page">
      <div className="creations-toolbar" aria-label={t("creations.searchLabel")}>
        <input
          className="creations-search-input"
          type="search"
          value={searchQuery}
          placeholder={t("creations.search")}
          aria-label={t("creations.searchLabel")}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {isLoading && <CreationsLoadingState />}

      {!isLoading && error && (
        <div className="creations-empty-state creations-empty-state--error">
          <div>
            <p>{t("creations.loadError")}</p>
            <span>{error}</span>
          </div>
          <button type="button" className="secondary-button" onClick={handleRetry}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && !error && visibleCreations.length > 0 && (
        <div className="creations-grid">
          {visibleCreations.map((creation) => (
            <CreationCard
              key={creation.id}
              creation={creation}
              onOpenWorkspace={onOpenWorkspace}
              t={t}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && creations.length === 0 && (
        <div className="creations-empty-state">
          {t("creations.empty")}
        </div>
      )}

      {!isLoading && !error && creations.length > 0 && visibleCreations.length === 0 && (
        <div className="creations-empty-state">
          {t("creations.noMatch")}
        </div>
      )}
    </section>
  );
}

function CreationCard({ creation, onOpenWorkspace, t }) {
  const canOpenWorkspace = creation.workspaceAvailable && typeof onOpenWorkspace === "function";

  return (
    <article className="creation-card">
      <div className="creation-card__preview" aria-label={`${creation.title} preview`}>
        {creation.previewImageUrl ? (
          <img
            src={creation.previewImageUrl}
            alt={`${creation.title} preview`}
            loading="lazy"
          />
        ) : creation.previewUrl ? (
          <iframe
            src={creation.previewUrl}
            title={`${creation.title} preview`}
            loading="lazy"
            tabIndex={-1}
          />
        ) : (
          <div className="creation-card__preview-placeholder">
            <div className="creation-card__cell-preview" aria-hidden="true">
              <span className="creation-card__cell-glow" />
              <span className="creation-card__cell-membrane" />
              <span className="creation-card__cell-core" />
              <span className="creation-card__cell-orbit creation-card__cell-orbit--one" />
              <span className="creation-card__cell-orbit creation-card__cell-orbit--two" />
              <span className="creation-card__cell-dot creation-card__cell-dot--one" />
              <span className="creation-card__cell-dot creation-card__cell-dot--two" />
              <span className="creation-card__cell-dot creation-card__cell-dot--three" />
            </div>
            <span>{t("creations.previewUnavailable")}</span>
          </div>
        )}
      </div>

      <div className="creation-card__body">
        <div className="creation-card__eyebrow">{formatStage(creation.stage, t)}</div>
        <h2>{creation.title}</h2>
        
        <div className="creation-card__summary-block">
          <p className="creation-card__summary">
            {creation.description || t("creations.noSummary")}
          </p>
        </div>

        <dl className="creation-card__meta">
          <div>
            <dt>{t("creations.createdBy")}</dt>
            <dd>{creation.originCellId}</dd>
          </div>
          <div>
            <dt>{t("creations.artifact")}</dt>
            <dd>{creation.artifactId}</dd>
          </div>
          {creation.provider && (
            <div>
              <dt>{t("creations.runtime")}</dt>
              <dd>{formatRuntime(creation)}</dd>
            </div>
          )}
        </dl>

        {creation.tags.length > 0 && (
          <div className="creation-card__tags" aria-label={t("creations.tags")}>
            {creation.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="creation-card__footer">
          <span className={`creation-status creation-status--${slugify(creation.status)}`}>
            {formatStatus(creation.status, t)}
          </span>
          <div className="creation-card__actions">
            <a
              className="secondary-button creation-card__action"
              href={getArtifactDownloadUrl(creation)}
              download={`${creation.artifactId}.zip`}
              title={t("creations.downloadTitle")}
            >
              {t("creations.artifact")}
            </a>
            <button
              type="button"
              className="secondary-button creation-card__action"
              disabled={!canOpenWorkspace}
              title={t(canOpenWorkspace ? "creations.openWorkspaceTitle" : "creations.workspaceUnavailable")}
              onClick={() => onOpenWorkspace?.(creation)}
            >
              {t("creations.showCell")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CreationsLoadingState() {
  const { t } = useUiPreferences();
  return (
    <div className="creations-grid" aria-label={t("creations.loading")}>
      {Array.from({ length: 4 }).map((_, index) => (
        <article className="creation-card creation-card--skeleton" key={index}>
          <div className="creation-card__preview" />
          <div className="creation-card__body">
            <div className="creation-skeleton-line creation-skeleton-line--short" />
            <div className="creation-skeleton-line creation-skeleton-line--title" />
            <div className="creation-skeleton-line" />
            <div className="creation-skeleton-line creation-skeleton-line--button" />
          </div>
        </article>
      ))}
    </div>
  );
}

function formatStage(value, t) {
  const normalized = String(value ?? "seed").toLowerCase();
  const key = ({ seed: "creations.stageSeed", growing: "creations.stageGrowing", mature: "creations.stageMature", stable: "creations.stageStable" })[normalized];
  return (key ? t(key) : normalized).toUpperCase();
}

function formatStatus(value, t) {
  const normalized = String(value ?? "idle").toLowerCase().replaceAll("_", "-");
  const key = ({ idle: "status.idle", active: "status.active", growing: "observatory.growing", stable: "status.stable", sufficient: "creations.sufficient", insufficient: "status.insufficient", "insufficient-evidence": "observatory.insufficientEvidence", error: "creations.error" })[normalized];
  if (key) return t(key);
  return normalized
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRuntime(creation) {
  return [creation.provider, creation.model].filter(Boolean).join(" / ");
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
