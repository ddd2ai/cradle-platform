import { useEffect, useState } from "react";
import { activateCell, deactivateCell } from "../api/cradleClient";

export function useCellCultivationActions({ onSuccess } = {}) {
  const [activeAction, setActiveAction] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(timerId);
  }, [message]);

  async function run(actionName, cellId, action) {
    if (!cellId || activeAction) {
      return;
    }

    try {
      setActiveAction(actionName);
      setMessage(null);
      setError(null);
      await action(cellId);
      await onSuccess?.(cellId);
      setMessage(
        actionName === "activate"
          ? "Cell cultivation activated."
          : "Cell cultivation deactivated.",
      );
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActiveAction(null);
    }
  }

  return {
    activate: (cellId) => run("activate", cellId, activateCell),
    deactivate: (cellId) => run("deactivate", cellId, deactivateCell),
    activeAction,
    isActivating: activeAction === "activate",
    isDeactivating: activeAction === "deactivate",
    message,
    error,
  };
}

