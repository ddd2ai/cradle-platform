/**
 * Lifecycle Commands
 *
 * 生命週期相關指令：
 * - /lifecycle: 顯示當前 lifecycle decision
 * - /lifecycle-plan: 建立 lifecycle 執行計劃（dry-run）
 * - /lifecycle-run --dry-run: 規劃執行（不實際執行）
 * - /lifecycle-run --apply: 執行計劃（受安全策略保護）
 */

import {
  createLifecyclePlan,
  applyLifecyclePlan,
} from "../lifecycle/lifecycle-orchestrator.js";

/**
 * Render lifecycle plan (dry-run mode)
 */
function renderLifecyclePlan(plan) {
  const lines = [
    "",
    "Lifecycle Plan (Dry-run)",
    "",
    `Cell      : ${plan.decision?.detail?.maturity ? "current cell" : "unknown"}`,
    `Action    : ${plan.action}`,
    `Mode      : ${plan.mode}`,
    `Command   : ${plan.command ?? "none"}`,
    `Reason    : ${plan.reason}`,
    "",
  ];

  if (plan.decision) {
    lines.push("Decision Context");
    lines.push(`- Confidence  : ${plan.decision.confidence}`);
    lines.push(`- Reason      : ${plan.decision.reason}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Render lifecycle apply result
 */
function renderLifecycleApplyResult(result) {
  const lines = [
    "",
    "Lifecycle Apply Result",
    "",
    `Action    : ${result.action}`,
    `Applied   : ${result.applied ? "yes" : "no"}`,
  ];

  if (result.blocked) {
    lines.push(`Blocked   : yes`);
  }

  if (result.result) {
    lines.push(`Result    : ${result.result}`);
  }

  lines.push(`Reason    : ${result.reason}`);

  if (result.manualCommand) {
    lines.push(`Manual    : ${result.manualCommand}`);
  }

  lines.push("");

  if (result.plan?.decision) {
    lines.push("Decision Context");
    lines.push(`- Confidence  : ${result.plan.decision.confidence}`);
    lines.push(`- Reason      : ${result.plan.decision.reason}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Create lifecycle commands
 */
export function createLifecycleCommands() {
  return [
  // /lifecycle-plan: create lifecycle execution plan
  {
    name: "/lifecycle-plan",
    match: (input, { engine }) =>
      input === "/lifecycle-plan" && !engine.isCradleMode(),

    execute: async ({ engine }) => {
      const cell = engine.getActiveCell();
      const plan = await createLifecyclePlan(cell, engine);

      console.log(renderLifecyclePlan(plan));
    },
  },

  // /lifecycle-run --dry-run: plan execution
  {
    name: "/lifecycle-run --dry-run",
    match: (input, { engine }) =>
      input === "/lifecycle-run --dry-run" && !engine.isCradleMode(),

    execute: async ({ engine }) => {
      const cell = engine.getActiveCell();
      const plan = await createLifecyclePlan(cell, engine);

      console.log(renderLifecyclePlan(plan));
    },
  },

  // /lifecycle-run --apply: apply execution (with safety layer)
  {
    name: "/lifecycle-run --apply",
    match: (input, { engine }) =>
      input === "/lifecycle-run --apply" && !engine.isCradleMode(),

    execute: async ({ engine }) => {
      const cell = engine.getActiveCell();
      const plan = await createLifecyclePlan(cell, engine);

      const result = await applyLifecyclePlan(cell, engine, plan, {
        allowRepair: true,
        allowDivide: false,
        allowMerge: false,
      });

      console.log(renderLifecycleApplyResult(result));
    },
  },
];
}

