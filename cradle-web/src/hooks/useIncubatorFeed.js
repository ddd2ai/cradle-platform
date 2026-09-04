import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArtifactTypes, fetchOperations, uploadStimulusFile } from "../api/cradleClient";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

export function useIncubatorFeed() {
  const { t } = useUiPreferences();
  const feedingRef = useRef(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [feedMessage, setFeedMessage] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [acceptedOperation, setAcceptedOperation] = useState(null);
  const [artifactTypes, setArtifactTypes] = useState([]);
  const [artifactType, setArtifactType] = useState("");

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
      files.length === 1
        ? t("incubator.acceptingFile", { name: files[0].name })
        : t("incubator.acceptingStimuli", { count: files.length }),
    );

    try {
      for (const file of files) {
        // Incubator feeding is intentionally untargeted. The server selects Cells
        // from reproducible Living Context relevance instead of UI selection.
        const accepted = await uploadStimulusFile(file, {
          artifactType: artifactType || null,
        });
        setAcceptedOperation(accepted);
      }
      setFeedMessage(t("incubator.acceptedRouting"));
    } catch (error) {
      setFeedError(error.message);
    } finally {
      feedingRef.current = false;
      setIsFeeding(false);
    }
  }, [artifactType, t]);

  const dismissOperation = useCallback((operationId) => {
    setAcceptedOperation((current) =>
      current?.operationId === operationId ? null : current
    );
  }, []);

  return {
    acceptedOperation,
    artifactTypes,
    artifactType,
    dismissOperation,
    feedError,
    feedFiles,
    feedMessage,
    isFeeding,
    setArtifactType,
  };
}

export function hasFilePayload(dataTransfer) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}
