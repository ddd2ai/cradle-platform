import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelOperation,
  fetchOperations,
  uploadStimulusFile,
} from "../api/cradleClient";
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

  useEffect(() => queueRef.current.subscribe(setFeedItems), []);

  useEffect(() => {
    let cancelled = false;
    fetchOperations()
      .then((operations) => operations.filter(
        (operation) => operation.type === "stimulus-cultivation" && (
          !["completed", "failed", "cancelled"].includes(operation.status) ||
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
        artifactType: null,
      });
      setFeedMessage(t("incubator.queuedStimuli", { count: queued.length }));
      return queued;
    } catch (error) {
      setFeedError(error.message);
      return [];
    }
  }, [t]);

  const dismissFeedItem = useCallback((feedId) => {
    queueRef.current.dismiss(feedId);
  }, []);

  const retryFeedItem = useCallback((feedId) => {
    queueRef.current.retry(feedId);
  }, []);

  const cancelFeedItem = useCallback(async (feedId) => {
    const item = queueRef.current.list().find((candidate) => candidate.feedId === feedId);
    if (!item) return;
    if (item.state === "queued") {
      queueRef.current.cancelQueued(feedId);
      return;
    }
    if (!item.operation?.operationId) return;
    try {
      const operation = await cancelOperation(item.operation.operationId);
      if (operation) queueRef.current.updateOperation(feedId, operation);
    } catch (error) {
      queueRef.current.setActionError(feedId, error);
    }
  }, []);

  return {
    cancelFeedItem,
    dismissFeedItem,
    feedError,
    feedFiles,
    feedItems,
    feedMessage,
    retryFeedItem,
  };
}

export function hasFilePayload(dataTransfer) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}
