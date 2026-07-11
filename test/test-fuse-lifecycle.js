import assert from "node:assert/strict";
import { decideCellLifecycle } from "../src/dna/dna-lifecycle.js";
import {
  applyLifecyclePlan,
  createLifecyclePlan,
} from "../src/lifecycle/lifecycle-orchestrator.js";
import {
  canApplyLifecycleAction,
  LIFECYCLE_ACTIONS,
} from "../src/lifecycle/lifecycle-policy.js";

const decision = decideCellLifecycle({
  maturityInfo: {
    sampleSize: 5,
    maturity: 0.65,
    percent: 65,
    temporalVariance: 0.05,
    normalizedMagnitude: 0.5,
    convergence: 0.95,
    state: "stable",
  },
  crossTraitVariance: 0.02,
  dominantTrait: { trait: "COLLABORATION", value: 0.7 },
  hasComplementaryCell: true,
});

assert.equal(decision.action, "fuse");
assert.equal(LIFECYCLE_ACTIONS.FUSE, "fuse");

const events = [];
const cell = {
  getLifecycleDecision: async () => decision,
  appendLifecycleEvent: async (event) => events.push(event),
};
const engine = {};
const plan = await createLifecyclePlan(cell, engine);

assert.equal(plan.action, "fuse");
assert.match(plan.reason, /\/fuse/);

const guard = canApplyLifecycleAction("fuse", { allowFuse: false });
assert.equal(guard.allowed, false);
assert.equal(guard.manualCommand, "/fuse");

const result = await applyLifecyclePlan(cell, engine, plan, {
  allowFuse: false,
});

assert.equal(result.applied, false);
assert.equal(result.blocked, true);
assert.equal(result.manualCommand, "/fuse");
assert.equal(events.length, 1);
assert.equal(events[0].action, "fuse");

console.log("✅ Fuse lifecycle decision, plan, and policy passed");
