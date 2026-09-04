import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArtifactTypes, fetchOperations, uploadStimulusFile } from "../api/cradleClient";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";
import { StimulusFeedQueue } from "../services/stimulus-feed-queue";

const RESTORED_FEED_LIMIT = 12;

export function useIncubatorFeed() {
  const { t } = useUiPreferences();
  const queueRef = useRef(null);
  if (!queueRef.current) {
    queueRef.current = new StimulusFeedQueue({
      upload: uploadStimulusFile,
      concurrency: 2,
    });
  }
  const [feedItems, setFeedItems] = useState(() => queueRef.current.list());
  const [feedMessage, setFeedMessage] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [artifactTypes, setArtifactTypes] = useState([]);
  const [artifactType, setArtifactType] = useState("");

  useEffect(() => queueRef.current.subscribe(setFeedItems), []);

  useEffect(() => {
    let cancelled = false;
    fetchOperations()
      .then((operations) => operations.filter(
        (operation) => operation.type === "stimulus-cultivation" && (
          !["completed", "failed"].includes(operation.status) ||
          operation.lifeState === "needs_attention"
        ),
      ))
      .then((operations) => {
        // The activity rail is a recent working set, not operation storage.
        // Older authoritative history remains available from the server.
        if (!cancelled) queueRef.current.adoptOperations(operations.slice(0, RESTORED_FEED_LIMIT));
      })
      .catch(() => {
        // Cell snapshots remain authoritative when operation history is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchArtifactTypes()
      .then((items) => {
        if (!cancelled) setArtifactTypes(items);
      })
      .catch(() => {
        // Absorb-only remains available if capability discovery is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!feedMessage) return undefined;

    const timeoutId = window.setTimeout(() => setFeedMessage(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedMessage]);

  const feedFiles = useCallback((fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return [];

    setFeedError(null);
    try {
      // Queueing is local and immediate. Authoritative cultivation starts only
      // after each POST is accepted, and Cell routing remains server-owned.
      const queued = queueRef.current.enqueue(files, {
        artifactType: artifactType || null,
      });
      setFeedMessage(t("incubator.queuedStimuli", { count: queued.length }));
      return queued;
    } catch (error) {
      setFeedError(error.message);
      return [];
    }
  }, [artifactType, t]);

  const dismissFeedItem = useCallback((feedId) => {
    queueRef.current.dismiss(feedId);
  }, []);

  const retryFeedItem = useCallback((feedId) => {
    queueRef.current.retry(feedId);
  }, []);

  return {
    artifactTypes,
    artifactType,
    dismissFeedItem,
    feedError,
    feedFiles,
    feedItems,
    feedMessage,
    retryFeedItem,
    setArtifactType,
  };
}

export function hasFilePayload(dataTransfer) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}
