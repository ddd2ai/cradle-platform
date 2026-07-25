// dna-lifecycle.js
// Cell lifecycle decision logic based on DNA maturity and trait distribution

/**
 * Calculate mean of numeric values
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Mean value
 */
export function calculateMean(values = []) {
  if (values.length === 0) return 0;

  return values.reduce(
    (sum, value) => sum + Number(value ?? 0),
    0
  ) / values.length;
}

/**
 * Calculate variance of numeric values
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Variance
 */
export function calculateVariance(values = []) {
  if (values.length === 0) return 0;

  const mean = calculateMean(values);

  return values.reduce((sum, value) => {
    return sum + Math.pow(Number(value ?? 0) - mean, 2);
  }, 0) / values.length;
}

/**
 * Calculate cross-trait variance to measure specialization
 * High variance = specialized (strong in specific traits)
 * Low variance = generalized (balanced across traits)
 * 
 * @param {Object} traitScores - DNA trait scores
 * @returns {number} Cross-trait variance
 */
export function calculateCrossTraitVariance(traitScores = {}) {
  return calculateVariance(
    Object.values(traitScores).map(Number)
  );
}

/**
 * Find the dominant (strongest) trait
 * @param {Object} traitScores - DNA trait scores
 * @returns {Object} Dominant trait info
 */
export function findDominantTrait(traitScores = {}) {
  const entries = Object.entries(traitScores);

  if (entries.length === 0) {
    return {
      trait: null,
      value: 0,
      dominanceRatio: 0,
    };
  }

  const sorted =
    entries
      .map(([trait, value]) => [trait, Number(value ?? 0)])
      .sort((a, b) => b[1] - a[1]);

  const [topTrait, topValue] = sorted[0];
  const secondValue = sorted[1]?.[1] ?? 0;

  return {
    trait: topTrait,
    value: topValue,
    dominanceRatio:
      secondValue === 0
        ? 1
        : topValue / secondValue,
  };
}

/**
 * Decide cell lifecycle action based on DNA maturity and traits
 * 
 * Decision logic:
 * - stay: not ready for change (growing or insufficient data)
 * - repair: unstable or high failure rate
 * - divide: mature, stable, powerful, specialized
 * - fuse: stable, generalized, has complementary cell
 * 
 * @param {Object} options - Decision parameters
 * @param {Object} options.maturityInfo - DNA maturity information
 * @param {number} options.crossTraitVariance - Cross-trait variance
 * @param {Object} options.dominantTrait - Dominant trait info
 * @param {boolean} options.hasComplementaryCell - Whether complementary cell exists
 * @param {number} options.recentFailureRate - Recent failure rate (0-1)
 * @returns {Object} Lifecycle decision
 */
export function decideCellLifecycle({
  maturityInfo,
  crossTraitVariance,
  dominantTrait,
  hasComplementaryCell = false,
  complementaryCellId = null,
  recentFailureRate = 0,
} = {}) {
  const {
    sampleSize = 0,
    maturity = 0,
    percent = 0,
    temporalVariance = 1,
    normalizedMagnitude = 0,
    convergence = 0,
    state = "seed",
  } = maturityInfo ?? {};

  // Rule 1: Not enough data
  if (sampleSize < 5) {
    return createLifecycleDecision({
      action: "stay",
      confidence: "low",
      reasonCode: "insufficient_samples",
      reason: "not enough dna history",
      crossTraitVariance,
      recentFailureRate,
      complementaryCellId,
      detail: {
        sampleSize,
        requiredSampleSize: 5,
      },
    });
  }

  // Rule 2: Unstable or high failure rate → repair
  const dnaUnstable =
    temporalVariance > 0.20;
  const artifactFailures =
    recentFailureRate > 0.30;

  if (dnaUnstable || artifactFailures) {
    return createLifecycleDecision({
      action: "repair",
      confidence: "medium",
      reasonCode: artifactFailures
        ? "high_failure_rate"
        : "high_temporal_variance",
      reason: artifactFailures
        ? "recent artifact execution failures detected"
        : "dna vector is unstable",
      crossTraitVariance,
      recentFailureRate,
      complementaryCellId,
      detail: {
        repairSignals: {
          dnaUnstable,
          artifactFailures,
        },
        temporalVariance,
        recentFailureRate,
        repairVarianceThreshold: 0.20,
        repairFailureRateThreshold: 0.30,
      },
    });
  }

  // Rule 3: Still growing → stay
  if (maturity < 0.60) {
    return createLifecycleDecision({
      action: "stay",
      confidence: "medium",
      reasonCode: "maturity_below_threshold",
      reason: "cell is still growing",
      crossTraitVariance,
      recentFailureRate,
      complementaryCellId,
      detail: {
        maturity,
        percent,
        state,
        requiredMaturity: 0.60,
      },
    });
  }

  // Rule 4: Ready to divide (mature + stable + powerful + specialized)
  if (
    maturity >= 0.75 &&
    temporalVariance <= 0.08 &&
    normalizedMagnitude >= 0.60 &&
    crossTraitVariance >= 0.04
  ) {
    return createLifecycleDecision({
      action: "divide",
      confidence: "high",
      reasonCode: "stable_specialization",
      reason: "cell is mature, stable, powerful, and specialized",
      crossTraitVariance,
      recentFailureRate,
      complementaryCellId,
      detail: {
        maturity,
        percent,
        temporalVariance,
        normalizedMagnitude,
        crossTraitVariance,
        convergence,
        dominantTrait,
      },
    });
  }

  // Rule 5: Ready to fuse (stable + generalized + has complementary cell)
  if (
    maturity >= 0.60 &&
    temporalVariance <= 0.10 &&
    normalizedMagnitude >= 0.45 &&
    crossTraitVariance < 0.04 &&
    hasComplementaryCell
  ) {
    return createLifecycleDecision({
      action: "fuse",
      confidence: "medium",
      reasonCode: "stable_generalization_with_complement",
      reason: "cell is stable and generalized, with complementary cell available",
      crossTraitVariance,
      recentFailureRate,
      complementaryCellId,
      detail: {
        maturity,
        percent,
        temporalVariance,
        normalizedMagnitude,
        crossTraitVariance,
        convergence,
        dominantTrait,
        hasComplementaryCell,
      },
    });
  }

  // Rule 6: Default → stay (stable but not ready for structural change)
  return createLifecycleDecision({
    action: "stay",
    confidence: "medium",
    reasonCode: "normal_growth",
    reason: "cell is stable but not ready for structural change",
    crossTraitVariance,
    recentFailureRate,
    complementaryCellId,
    detail: {
      maturity,
      percent,
      state,
      temporalVariance,
      normalizedMagnitude,
      crossTraitVariance,
      convergence,
      dominantTrait,
      hasComplementaryCell,
    },
  });
}

export function toLifecycleView({
  maturityInfo,
  decision,
  recentFailureRate = 0,
} = {}) {
  return {
    phase: resolveLifecyclePhase(maturityInfo?.state),
    health: resolveLifecycleHealth({
      recentFailureRate,
      temporalVariance: maturityInfo?.temporalVariance,
    }),
    nextEvolution: resolveNextEvolution(decision?.action),
    convergence: resolveConvergence(maturityInfo?.convergence),
    failureRate: Math.round(
      Math.max(0, Math.min(100, Number(recentFailureRate ?? 0) * 100)),
    ),
  };
}

function createLifecycleDecision({
  action,
  confidence,
  reasonCode,
  reason,
  crossTraitVariance = 0,
  recentFailureRate = 0,
  complementaryCellId = null,
  detail = {},
}) {
  return {
    action,
    confidence,
    reason,
    reasonCode,
    crossTraitVariance,
    recentFailureRate,
    complementaryCellId,
    detail,
  };
}

function resolveLifecyclePhase(state) {
  const phases = {
    seed: "Seed",
    growing: "Growing",
    stable: "Stable",
    mature: "Mature",
    saturated: "Saturated",
  };

  return phases[state] ?? "Seed";
}

function resolveLifecycleHealth({
  recentFailureRate = 0,
  temporalVariance = 0,
} = {}) {
  if (recentFailureRate > 0.30 || temporalVariance > 0.20) {
    return "Unstable";
  }

  if (recentFailureRate > 0 || temporalVariance > 0.10) {
    return "Recovering";
  }

  return "Healthy";
}

function resolveNextEvolution(action) {
  const nextEvolution = {
    stay: "Continue",
    repair: "Repair",
    divide: "Divide",
    fuse: "Fuse",
  };

  return nextEvolution[action] ?? "Continue";
}

function resolveConvergence(convergence = 0) {
  if (convergence < 0.40) {
    return "Initializing";
  }

  if (convergence < 0.70) {
    return "Developing";
  }

  if (convergence < 0.90) {
    return "Converging";
  }

  return "Converged";
}
