import { useEffect, useState } from "react";
import {
  getOperationState,
  subscribeOperationProgress,
} from "../services/operation-progress.js";

/**
 * Operation Progress 訂閱 Hook
 *
 * 直接訂閱 operation-progress store,讓元件無需透過 props 接收 progress 更新。
 * 搭配 Phase 2 的 throttling 機制,progress 更新只會觸發使用此 hook 的元件 re-render,
 * 不影響父元件(IncubatorPage)或其他 siblings(IncubatorWorkspace、CellInspectorDrawer)。
 *
 * @param {string|null} operationId - Server 指派的 operation ID
 * @returns {Object|null} 最新的 operation 物件,或 null (無 operationId 或尚未收到更新)
 *
 * @example
 * function OperationProgress({ operationId }) {
 *   const operation = useOperationProgress(operationId);
 *   if (!operation) return null;
 *   return <progress value={operation.progress} />;
 * }
 */
export function useOperationProgress(operationId) {
  const [operation, setOperation] = useState(
    () => (operationId ? getOperationState(operationId) : null),
  );

  useEffect(() => {
    if (!operationId) {
      setOperation(null);
      return undefined;
    }

    // 訂閱前先同步最新狀態(避免錯過 operationId 設定前已推送的更新)
    const current = getOperationState(operationId);
    if (current) {
      setOperation(current);
    }

    return subscribeOperationProgress(operationId, setOperation);
  }, [operationId]);

  return operation;
}
