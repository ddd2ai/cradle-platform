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

  // Blocked by policy
  if (!guard.allowed) {
    return {
      applied: false,
      action: plan.action,
      blocked: true,
      reason: guard.reason,
      manualCommand: guard.manualCommand ?? null,
      plan,
    };
  }

  // stay: no-op (always allowed)
  if (plan.action === "stay") {
    return {
      applied: true,
      action: "stay",
      result: "no-op",
      reason: "cell stays in current lifecycle state",
      plan,
    };
  }

  // repair: allowed (execution can be connected later)
  if (plan.action === "repair") {
    // 初版先不要硬綁某個 artifact repair
    // 如果目前沒有統一 repair 入口，可以先做成 apply record
    // 未來可以接到 stabilize flow 或其他修復機制
    return {
      applied: true,
      action: "repair",
      result: "repair accepted",
      reason: "repair action is allowed, execution can be connected to stabilize flow later",
      plan,
    };
  }

  // divide: blocked (structural action)
  if (plan.action === "divide") {
    return {
      applied: false,
      action: "divide",
      blocked: true,
      reason: "divide is a structural action and requires manual execution",
      manualCommand: "/divide-svd",
      plan,
    };
  }

  // merge: blocked (structural action)
  if (plan.action === "merge") {
    return {
      applied: false,
      action: "merge",
      blocked: true,
      reason: "merge is a structural action and requires manual execution",
      manualCommand: "/merge",
      plan,
    };
  }

  // unknown action: blocked
  return {
    applied: false,
    action: plan.action,
    blocked: true,
    reason: "structural lifecycle action is not enabled",
    plan,
  };
}
