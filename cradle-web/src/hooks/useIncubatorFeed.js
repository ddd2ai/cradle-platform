import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOperations, uploadStimulusFile } from "../api/cradleClient";

export function useIncubatorFeed() {
  const feedingRef = useRef(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [feedMessage, setFeedMessage] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [acceptedOperation, setAcceptedOperation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchOperations()
      .then((operations) => operations.find(
        (operation) => operation.type === "stimulus-cultivation" && (
          !["completed", "failed"].includes(operation.status) ||
          operation.lifeState === "needs_attention"
        ),
      ))
      .then((operation) => {
        if (!cancelled && operation) setAcceptedOperation(operation);
      })
      .catch(() => {
        // Cell snapshots remain authoritative when operation history is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!feedMessage || isFeeding) return undefined;

    const timeoutId = window.setTimeout(() => setFeedMessage(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedMessage, isFeeding]);

  const feedFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || feedingRef.current) return;

    feedingRef.current = true;
    setIsFeeding(true);
    setFeedError(null);
    setFeedMessage(
      `Accepting ${files.length === 1 ? files[0].name : `${files.length} stimuli`}...`,
    );

    try {
      for (const file of files) {
        // Incubator feeding is intentionally untargeted. The server selects Cells
        // from reproducible Living Context relevance instead of UI selection.
        const accepted = await uploadStimulusFile(file);
        setAcceptedOperation(accepted);
      }
      setFeedMessage("Accepted. Cradle is finding the right Cell.");
    } catch (error) {
      setFeedError(error.message);
    } finally {
      feedingRef.current = false;
      setIsFeeding(false);
    }
  }, []);

  const dismissOperation = useCallback((operationId) => {
    setAcceptedOperation((current) =>
      current?.operationId === operationId ? null : current
    );
  }, []);

  return {
    acceptedOperation,
    dismissOperation,
    feedError,
    feedFiles,
    feedMessage,
    isFeeding,
  };
}

export function hasFilePayload(dataTransfer) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}
