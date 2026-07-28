import { useEffect, useMemo, useState } from "react";
import { getArtifactDownloadUrl, getCreations } from "../features/creations/api";

export function CreationsPage({
  onOpenWorkspace,
  initialCreations = [],
  skipInitialLoad = false,
} = {}) {
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
          setCreations(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load creations.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCreations();

    return () => {
      cancelled = true;
    };
  }, [skipInitialLoad]);

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
            : "Unable to load creations.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <section className="platform-page creations-page">
      <div className="creations-toolbar" aria-label="Creations search">
        <input
          className="creations-search-input"
          type="search"
          value={searchQuery}
          placeholder="Search..."
          aria-label="Search creations"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {isLoading && <CreationsLoadingState />}

      {!isLoading && error && (
        <div className="creations-empty-state creations-empty-state--error">
          <div>
            <p>Unable to load creations.</p>
            <span>{error}</span>
          </div>
          <button type="button" className="secondary-button" onClick={handleRetry}>
            Retry
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
            />
          ))}
        </div>
      )}

      {!isLoading && !error && creations.length === 0 && (
        <div className="creations-empty-state">
          No creations found.
        </div>
      )}

      {!isLoading && !error && creations.length > 0 && visibleCreations.length === 0 && (
        <div className="creations-empty-state">
          No creations match the current search.
        </div>
      )}
    </section>
  );
}

function CreationCard({ creation, onOpenWorkspace }) {
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
            <span>Preview unavailable</span>
          </div>
        )}
      </div>

      <div className="creation-card__body">
        <div className="creation-card__eyebrow">{formatStage(creation.stage)}</div>
        <h2>{creation.title}</h2>
        
        <div className="creation-card__summary-block">
          <p className="creation-card__summary">
            {creation.description || "No artifact plan summary available yet."}
          </p>
        </div>

        <dl className="creation-card__meta">
          <div>
            <dt>Created by</dt>
            <dd>{creation.originCellId}</dd>
          </div>
          <div>
            <dt>Artifact</dt>
            <dd>{creation.artifactId}</dd>
          </div>
          {creation.provider && (
            <div>
              <dt>Runtime</dt>
              <dd>{formatRuntime(creation)}</dd>
            </div>
          )}
        </dl>

        {creation.tags.length > 0 && (
          <div className="creation-card__tags" aria-label="Tags">
            {creation.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="creation-card__footer">
          <span className={`creation-status creation-status--${slugify(creation.status)}`}>
            {formatStatus(creation.status)}
          </span>
          <div className="creation-card__actions">
            <a
              className="secondary-button creation-card__action"
              href={getArtifactDownloadUrl(creation)}
              download={`${creation.artifactId}.zip`}
              title="Download the artifact directory."
            >
              Artifact
            </a>
            <button
              type="button"
              className="secondary-button creation-card__action"
              disabled={!canOpenWorkspace}
              title={canOpenWorkspace ? "Open the origin Cell workspace." : "Workspace is not available."}
              onClick={() => onOpenWorkspace?.(creation)}
            >
              Show Cell
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CreationsLoadingState() {
  return (
    <div className="creations-grid" aria-label="Loading creations">
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

function formatStage(value) {
  return String(value ?? "seed").toUpperCase();
}

function formatStatus(value) {
  return String(value ?? "idle")
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
