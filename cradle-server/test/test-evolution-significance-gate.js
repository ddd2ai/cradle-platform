import assert from "assert";
import { evaluateEvolutionSignificance } from "../src/evolution/evolution-significance-gate.js";

const thoughts = [{ file: "thought-1.md" }];
assert.equal(evaluateEvolutionSignificance({ thoughts, evidence: [] }).eligible, false);
assert.equal(evaluateEvolutionSignificance({ thoughts, evidence: [], force: true }).eligible, true);

const critical = evaluateEvolutionSignificance({
  thoughts,
  evidence: [{
    evidenceId: "e1",
    risk: 0.9,
    stateImpact: 0.85,
    confidence: 1,
  }],
});
assert.equal(critical.eligible, true);
assert.equal(critical.reason, "critical state-impact evidence");

const persistent = evaluateEvolutionSignificance({
  thoughts,
  evidence: [
    { evidenceId: "e1", causationId: "c1", risk: 0.4, stateImpact: 0.6, confidence: 0.8 },
    { evidenceId: "e2", causationId: "c2", risk: 0.4, stateImpact: 0.6, confidence: 0.8 },
  ],
});
assert.equal(persistent.eligible, true);
assert.equal(persistent.reason, "persistent state-impact evidence");

console.log("Evolution significance gate tests passed");
