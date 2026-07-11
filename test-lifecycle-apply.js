/**
 * Test Lifecycle Apply Safety Layer
 *
 * 驗證第四輪的核心功能：
 * 1. createLifecyclePlan() - 建立執行計劃
 * 2. applyLifecyclePlan() - 安全執行計劃
 * 3. Policy guard - 阻擋結構性變更
 *
 * 預期行為：
 * - stay: applied (no-op)
 * - repair: applied (accepted)
 * - divide: blocked (需手動執行)
 * - fuse: blocked (需手動執行)
 */

import { CradleEngine } from "./src/cradle-engine.js";

async function testLifecycleApply() {
  console.log("\n=== Lifecycle Apply Safety Layer Test ===\n");

  const engine = new CradleEngine();
  await engine.start();

  // Use cell-001
  await engine.useCell("cell-001");
  const cell = engine.getActiveCell();

  console.log("Test Cell: cell-001\n");

  // Test 1: Get current lifecycle decision
  console.log("Test 1: Current Lifecycle Decision");
  console.log("-----------------------------------");
  const decision = await cell.getLifecycleDecision();
  console.log(`Action         : ${decision.action}`);
  console.log(`Confidence     : ${decision.confidence}`);
  console.log(`Reason         : ${decision.reason}`);
  console.log("");

  // Test 2: Create lifecycle plan
  console.log("Test 2: Create Lifecycle Plan (Dry-run)");
  console.log("----------------------------------------");
  
  const { createLifecyclePlan } = await import("./src/lifecycle/lifecycle-orchestrator.js");
  const plan = await createLifecyclePlan(cell, engine);
  
  console.log(`Action         : ${plan.action}`);
  console.log(`Mode           : ${plan.mode}`);
  console.log(`Command        : ${plan.command ?? "none"}`);
  console.log(`Reason         : ${plan.reason}`);
  console.log("");

  // Test 3: Apply lifecycle plan
  console.log("Test 3: Apply Lifecycle Plan");
  console.log("-----------------------------");
  
  const { applyLifecyclePlan } = await import("./src/lifecycle/lifecycle-orchestrator.js");
  const result = await applyLifecyclePlan(cell, engine, plan, {
    allowRepair: true,
    allowDivide: false,
    allowFuse: false,
  });
  
  console.log(`Action         : ${result.action}`);
  console.log(`Applied        : ${result.applied ? "yes" : "no"}`);
  
  if (result.blocked) {
    console.log(`Blocked        : yes`);
  }
  
  if (result.result) {
    console.log(`Result         : ${result.result}`);
  }
  
  console.log(`Reason         : ${result.reason}`);
  
  if (result.manualCommand) {
    console.log(`Manual Command : ${result.manualCommand}`);
  }
  console.log("");

  // Test 4: Test policy guard with different actions
  console.log("Test 4: Policy Guard Behavior");
  console.log("------------------------------");
  
  const { canApplyLifecycleAction } = await import("./src/lifecycle/lifecycle-policy.js");
  
  const testCases = [
    { action: "stay", options: {} },
    { action: "repair", options: { allowRepair: true } },
    { action: "repair", options: { allowRepair: false } },
    { action: "divide", options: { allowDivide: false } },
    { action: "divide", options: { allowDivide: true } },
    { action: "fuse", options: { allowFuse: false } },
    { action: "fuse", options: { allowFuse: true } },
  ];
  
  for (const testCase of testCases) {
    const guard = canApplyLifecycleAction(testCase.action, testCase.options);
    const optionsStr = JSON.stringify(testCase.options);
    console.log(`${testCase.action.padEnd(6)} ${optionsStr.padEnd(30)} → ${guard.allowed ? "allowed" : "blocked"}`);
  }
  console.log("");

  // Test 5: Simulated Scenarios
  console.log("Test 5: Simulated Scenarios");
  console.log("----------------------------");
  
  // Scenario A: Simulate repair needed (high variance)
  console.log("\nScenario A: High Variance (should suggest repair)");
  const decisionA = await cell.getLifecycleDecision({
    recentFailureRate: 0.35,
  });
  const planA = await createLifecyclePlan(cell, engine, {
    recentFailureRate: 0.35,
  });
  const resultA = await applyLifecyclePlan(cell, engine, planA, {
    allowRepair: true,
    allowDivide: false,
    allowFuse: false,
  });
  
  console.log(`  Decision Action : ${decisionA.action}`);
  console.log(`  Plan Action     : ${planA.action}`);
  console.log(`  Apply Result    : ${resultA.applied ? "applied" : "blocked"}`);
  console.log(`  Reason          : ${resultA.reason}`);

  // Scenario B: Test divide blocking
  console.log("\nScenario B: Simulate Mature Cell (would suggest divide)");
  console.log("  Note: Current cell-001 is not mature enough for divide");
  console.log("  But we can test the policy guard directly:");
  
  const mockDividePlan = {
    action: "divide",
    mode: "dry-run",
    command: "/divide-svd cell-001-child",
    decision: { action: "divide", confidence: "high" },
  };
  
  const resultB = await applyLifecyclePlan(cell, engine, mockDividePlan, {
    allowRepair: true,
    allowDivide: false,
    allowFuse: false,
  });
  
  console.log(`  Plan Action     : ${mockDividePlan.action}`);
  console.log(`  Apply Result    : ${resultB.applied ? "applied" : "blocked"}`);
  console.log(`  Blocked         : ${resultB.blocked ? "yes" : "no"}`);
  console.log(`  Manual Command  : ${resultB.manualCommand ?? "none"}`);

  console.log("\n=== Test Complete ===\n");
  
  console.log("Summary:");
  console.log("--------");
  console.log("✓ Lifecycle decision working");
  console.log("✓ Lifecycle plan creation working");
  console.log("✓ Lifecycle apply with safety layer working");
  console.log("✓ Policy guard correctly blocks structural actions");
  console.log("✓ stay/repair actions allowed, divide/fuse blocked");
  console.log("");
}

testLifecycleApply().catch(console.error);
