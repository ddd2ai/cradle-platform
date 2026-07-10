/**
 * Lifecycle Orchestrator - Plan and Apply Lifecycle Actions
 *
 * 負責：
 * 1. createLifecyclePlan() - 建立 lifecycle 執行計劃（dry-run）
 * 2. applyLifecyclePlan() - 執行 lifecycle 計劃（apply）
 *
 * 這是 Cradle 從「advisor mode」走向「execution mode」的橋樑。
 */

import { canApplyLifecycleAction } from "./lifecycle-policy.js";
import { executeLifecycleRepair } from "./lifecycle-repair-service.js";

/**
 * Create a lifecycle execution plan
 *
 * 根據 Cell 的 lifecycle decision，建立執行計劃。
 * 這是 dry-run 模式，不會實際執行，只會規劃。
 *
 * @param {CradleCell} cell - Target cell
 * @param {CradleEngine} engine - Cradle engine
 * @param {Object} options - Decision options
 * @returns {Promise<Object>} Lifecycle plan
 */
export async function createLifecyclePlan(cell, engine, options = {}) {
  const decision = await cell.getLifecycleDecision(options);

  // divide: structural action (needs manual execution)
  if (decision.action === "divide") {
    return {
      action: "divide",
      mode: "dry-run",
      command: `/divide-svd ${cell.id}-child`,
      decision,
      reason: "division requires manual execution with /divide-svd",
    };
  }

  // merge: structural action (needs manual target selection)
  if (decision.action === "merge") {
    return {
      action: "merge",
      mode: "dry-run",
      command: null,
      decision,
      reason: "merge target selection is not finalized, use /merge command manually",
    };
  }

  // repair: can be applied (connect to stabilize flow)
  if (decision.action === "repair") {
    return {
      action: "repair",
      mode: "dry-run",
      command: "/stabilize",
      decision,
      reason: "repair can be applied, will connect to stabilize flow",
    };
  }

  // stay: no-op
  return {
    action: "stay",
    mode: "dry-run",
    command: null,
    decision,
    reason: "cell stays in current lifecycle state",
  };
}

/**
 * Apply a lifecycle plan
 *
 * 實際執行 lifecycle 計劃。
 * 通過 lifecycle-policy.js 的安全檢查。
 *
 * @param {CradleCell} cell - Target cell
 * @param {CradleEngine} engine - Cradle engine
 * @param {Object} plan - Lifecycle plan from createLifecyclePlan
 * @param {Object} options - Apply policy options
 * @returns {Promise<Object>} Apply result
 */
export async function applyLifecyclePlan(cell, engine, plan, options = {}) {
  const guard = canApplyLifecycleAction(plan.action, options);

  let result;

  // Blocked by policy
  if (!guard.allowed) {
    result = {
      applied: false,
      action: plan.action,
      blocked: true,
      reason: guard.reason,
      manualCommand: guard.manualCommand ?? null,
      plan,
    };
  }

  // stay: no-op (always allowed)
  else if (plan.action === "stay") {
    result = {
      applied: true,
      action: "stay",
      result: "no-op",
      reason: "cell stays in current lifecycle state",
      plan,
    };
  }

  // repair: allowed and execute
  else if (plan.action === "repair") {
    const repairResult = await executeLifecycleRepair(
      cell,
      engine,
      plan,
      options
    );

    result = {
      applied: repairResult.repaired,
      action: "repair",
      result: repairResult,
      reason: repairResult.reason,
      plan,
    };
  }

  // divide: blocked (structural action)
  else if (plan.action === "divide") {
    result = {
      applied: false,
      action: "divide",
      blocked: true,
      reason: "divide is a structural action and requires manual execution",
      manualCommand: "/divide-svd",
      plan,
    };
  }

  // merge: blocked (structural action)
  else if (plan.action === "merge") {
    result = {
      applied: false,
      action: "merge",
      blocked: true,
      reason: "merge is a structural action and requires manual execution",
      manualCommand: "/merge",
      plan,
    };
  }

  // unknown action: blocked
  else {
    result = {
      applied: false,
      action: plan.action,
      blocked: true,
      reason: "structural lifecycle action is not enabled",
      plan,
    };
  }

  // Log lifecycle event
  await cell.appendLifecycleEvent({
    action: result.action,
    applied: result.applied,
    blocked: result.blocked ?? false,
    reason: result.reason,
    detail: {
      decision: plan.decision,
      options,
    },
  });

  return result;
}
