import assert from "node:assert/strict";
import {
  decideCellLifecycle,
  toLifecycleView,
} from "../src/dna/dna-lifecycle.js";

const dominantTrait = { trait: "CREATION", value: 0.82 };

assertDecision(
  "insufficient samples",
  {
    maturityInfo: createMaturityInfo({ sampleSize: 4, maturity: 0.8 }),
    crossTraitVariance: 0.0184,
  },
  {
    action: "stay",
    reasonCode: "insufficient_samples",
  },
);

assertDecision(
  "high temporal variance",
  {
    maturityInfo: createMaturityInfo({
      sampleSize: 8,
      maturity: 0.8,
      temporalVariance: 0.21,
    }),
    crossTraitVariance: 0.0184,
  },
  {
    action: "repair",
    reasonCode: "high_temporal_variance",
  },
);

assertDecision(
  "high failure rate",
  {
    maturityInfo: createMaturityInfo({
      sampleSize: 8,
      maturity: 0.8,
      temporalVariance: 0.03,
    }),
    crossTraitVariance: 0.0184,
    recentFailureRate: 0.31,
  },
  {
    action: "repair",
    reasonCode: "high_failure_rate",
  },
);

assertDecision(
  "maturity below threshold",
  {
    maturityInfo: createMaturityInfo({
      sampleSize: 8,
      maturity: 0.59,
      temporalVariance: 0.03,
    }),
    crossTraitVariance: 0.0184,
  },
  {
    action: "stay",
    reasonCode: "maturity_below_threshold",
  },
);

assertDecision(
  "stable specialization",
  {
    maturityInfo: createMaturityInfo({
      sampleSize: 8,
      maturity: 0.76,
      temporalVariance: 0.08,
      normalizedMagnitude: 0.6,
    }),
    crossTraitVariance: 0.04,
    dominantTrait,
  },
  {
    action: "divide",
    reasonCode: "stable_specialization",
  },
);

assertDecision(
  "stable generalization with complement",
  {
    maturityInfo: createMaturityInfo({
      sampleSize: 8,
      maturity: 0.61,
      temporalVariance: 0.1,
      normalizedMagnitude: 0.45,
    }),
    crossTraitVariance: 0.039,
    dominantTrait,
    hasComplementaryCell: true,
    complementaryCellId: "cell-002",
  },
  {
    action: "fuse",
    reasonCode: "stable_generalization_with_complement",
    complementaryCellId: "cell-002",
  },
);

assertDecision(
  "normal growth",
  {
    maturityInfo: createMaturityInfo({
      sampleSize: 8,
      maturity: 0.62,
      temporalVariance: 0.11,
      normalizedMagnitude: 0.5,
    }),
    crossTraitVariance: 0.02,
    dominantTrait,
  },
  {
    action: "stay",
    reasonCode: "normal_growth",
  },
);

assert.deepEqual(
  toLifecycleView({
    maturityInfo: createMaturityInfo({
      state: "growing",
      convergence: 0.89,
      temporalVariance: 0.03,
    }),
    decision: { action: "stay" },
    recentFailureRate: 0,
  }),
  {
    phase: "Growing",
    health: "Healthy",
    nextEvolution: "Continue",
    convergence: "Converging",
    failureRate: 0,
  },
);

assert.deepEqual(
  toLifecycleView({
    maturityInfo: createMaturityInfo({
      state: "mature",
      convergence: 0.91,
      temporalVariance: 0.21,
    }),
    decision: { action: "repair" },
    recentFailureRate: 0.32,
  }),
  {
    phase: "Mature",
    health: "Unstable",
    nextEvolution: "Repair",
    convergence: "Converged",
    failureRate: 32,
  },
);

assert.equal(
  toLifecycleView({
    maturityInfo: createMaturityInfo({ convergence: 0.55 }),
    decision: { action: "divide" },
  }).convergence,
  "Developing",
);

console.log("DNA lifecycle decision detail tests passed");

function createMaturityInfo(overrides = {}) {
  return {
    sampleSize: 8,
    maturity: 0.7,
    percent: 70,
    temporalVariance: 0.03,
    normalizedMagnitude: 0.7,
    convergence: 0.97,
    state: "stable",
    ...overrides,
  };
}

function assertDecision(label, options, expected) {
  const decision = decideCellLifecycle({
    dominantTrait,
    recentFailureRate: 0,
    hasComplementaryCell: false,
    ...options,
  });

  assert.equal(decision.action, expected.action, label);
  assert.equal(decision.reasonCode, expected.reasonCode, label);
  assert.equal(
    decision.crossTraitVariance,
    options.crossTraitVariance,
    label,
  );
  assert.equal(
    decision.recentFailureRate,
    options.recentFailureRate ?? 0,
    label,
  );
  assert.equal(
    decision.complementaryCellId,
    expected.complementaryCellId ?? null,
    label,
  );
}
