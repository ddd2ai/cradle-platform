/**
 * Lifecycle Policy - Safety Layer for Lifecycle Actions
 *
 * 這是 Cradle 從「會建議」走向「能執行」的第一道閘門。
 *
 * 安全規則：
 * - stay: 允許（no-op）
 * - repair: 允許（可控的修復）
 * - divide: 阻擋（結構性變更，需手動執行）
 * - merge: 阻擋（結構性變更，需手動執行）
 */

/**
 * Lifecycle Action Types
 */
export const LIFECYCLE_ACTIONS = {
  STAY: "stay",
  REPAIR: "repair",
  DIVIDE: "divide",
  MERGE: "merge",
};

/**
 * Check if a lifecycle action can be applied
 *
 * 這個函式是保險絲，決定哪些 lifecycle action 可以自動執行。
 *
 * @param {string} action - Lifecycle action (stay, repair, divide, merge)
 * @param {Object} options - Policy options
 * @param {boolean} options.allowRepair - Allow repair apply (default: true)
 * @param {boolean} options.allowDivide - Allow divide apply (default: false)
 * @param {boolean} options.allowMerge - Allow merge apply (default: false)
 * @returns {Object} { allowed, reason, manualCommand }
 */
export function canApplyLifecycleAction(action, {
  allowRepair = true,
  allowDivide = false,
  allowMerge = false,
} = {}) {
  // stay: always allowed (no-op)
  if (action === LIFECYCLE_ACTIONS.STAY) {
    return {
      allowed: true,
      reason: "stay is a no-op action",
    };
  }

  // repair: allowed by default (can be disabled)
  if (action === LIFECYCLE_ACTIONS.REPAIR) {
    return {
      allowed: allowRepair,
      reason: allowRepair
        ? "repair apply is allowed"
        : "repair apply is disabled",
    };
  }

  // divide: blocked by default (structural change)
  if (action === LIFECYCLE_ACTIONS.DIVIDE) {
    return {
      allowed: allowDivide,
      reason: "divide is a structural action and is disabled for automatic apply",
      manualCommand: "/divide-svd",
    };
  }

  // merge: blocked by default (structural change)
  if (action === LIFECYCLE_ACTIONS.MERGE) {
    return {
      allowed: allowMerge,
      reason: "merge is a structural action and is disabled for automatic apply",
      manualCommand: "/merge",
    };
  }

  // unknown action: blocked
  return {
    allowed: false,
    reason: `unknown lifecycle action: ${action}`,
  };
}
