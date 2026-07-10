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

  // Handle repair result details
  if (result.result && typeof result.result === "object") {
    const repairResult = result.result;
    
    if (repairResult.repairType) {
      lines.push(`Type      : ${repairResult.repairType}`);
    }
    
    if (repairResult.artifactId) {
      lines.push(`Artifact  : ${repairResult.artifactId}`);
    }
    
    if (repairResult.suggestion) {
      lines.push(`Suggestion: ${repairResult.suggestion}`);
    }
    
    if (repairResult.error) {
      lines.push(`Error     : ${repairResult.error}`);
    }
  } else if (result.result) {
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
  // /lifecycle-events: view lifecycle history
  {
    name: "/lifecycle-events",
    match: (input, { engine }) =>
      input === "/lifecycle-events" && !engine.isCradleMode(),

    execute: async ({ engine }) => {
      const cell = engine.getActiveCell();
      const events = await cell.readLifecycleEvents();

      if (events.length === 0) {
        console.log("\nNo lifecycle events recorded yet.\n");
        return;
      }

      console.log("\nRecent Lifecycle Events\n");

      const recentEvents = events.slice(-10).reverse();

      for (const event of recentEvents) {
        const date = new Date(event.at).toISOString().split('T')[0];
        const applied = event.applied ? "applied" : event.blocked ? "blocked" : "failed";
        
        console.log(`${date}  ${event.action.padEnd(8)}  ${applied.padEnd(8)}  ${event.reason}`);
      }

      console.log(`\nTotal: ${events.length} events\n`);
    },
  },

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

  // /lifecycle-run --apply [artifact-id]: apply execution (with safety layer)
  {
    name: "/lifecycle-run --apply",
    match: (input, { engine }) =>
      input.startsWith("/lifecycle-run --apply") && !engine.isCradleMode(),

    execute: async ({ engine, input }) => {
      const cell = engine.getActiveCell();
      
      // Parse artifact-id from command
      // /lifecycle-run --apply artifact-xxx
      const parts = input.split(/\s+/);
      const artifactId = parts[2] ?? null;

      const plan = await createLifecyclePlan(cell, engine);

      const result = await applyLifecyclePlan(cell, engine, plan, {
        allowRepair: true,
        allowDivide: false,
        allowMerge: false,
        artifactId,
      });

      console.log(renderLifecycleApplyResult(result));
    },
  },
];
}

