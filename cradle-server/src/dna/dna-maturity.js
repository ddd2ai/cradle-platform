import {
  calculateTraitValue,
  calculateCellScore,
} from "./dna-measure.js";

import {
  DNA_TRAITS,
  clamp01,
} from "./dna-matrix.js";

/**
 * Calculate trait scores from DNA vector
 * @param {Object} dnaVector - DNA vector with factors for each trait
 * @returns {Object} Trait scores (mean of factors for each trait)
 */
export function calculateTraitScores(dnaVector = {}) {
  const scores = {};

  for (const trait of DNA_TRAITS) {
    scores[trait] = calculateTraitValue(dnaVector[trait] ?? {});
  }

  return scores;
}

/**
 * Convert trait scores to numeric vector for statistical analysis
 * @param {Object} traitScores - Trait scores object
 * @returns {Array<number>} 8-dimensional vector
 */
export function traitScoresToVector(traitScores = {}) {
  return DNA_TRAITS.map((trait) =>
    Number(traitScores[trait] ?? 0)
  );
}

/**
 * Calculate mean vector from multiple vectors
 * @param {Array<Array<number>>} vectors - Array of numeric vectors
 * @returns {Array<number>} Mean vector
 */
export function calculateMeanVector(vectors = []) {
  if (vectors.length === 0) return [];

  const dimensions = vectors[0].length;

  return Array.from({ length: dimensions }, (_, index) => {
    return vectors.reduce(
      (sum, vector) => sum + Number(vector[index] ?? 0),
      0
    ) / vectors.length;
  });
}

/**
 * Calculate squared Euclidean distance between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Squared distance
 */
export function calculateSquaredDistance(a = [], b = []) {
  return a.reduce((sum, value, index) => {
    return sum + Math.pow(
      Number(value ?? 0) - Number(b[index] ?? 0),
      2
    );
  }, 0);
}

/**
 * Calculate temporal variance of DNA vectors over time
 * Lower variance = more stable/converged
 * @param {Array<Array<number>>} vectors - Time series of DNA vectors
 * @returns {number} Temporal variance (average squared distance to mean)
 */
export function calculateTemporalVariance(vectors = []) {
  if (vectors.length < 2) {
    return 1;
  }

  const meanVector = calculateMeanVector(vectors);

  const totalSquaredDistance =
    vectors.reduce((sum, vector) => {
      return sum + calculateSquaredDistance(vector, meanVector);
    }, 0);

  return totalSquaredDistance / vectors.length;
}

/**
 * Calculate convergence from temporal variance
 * Higher convergence = more stable DNA pattern
 * @param {number} temporalVariance - Temporal variance value
 * @param {number} scale - Scale factor for variance
 * @returns {number} Convergence score (0-1)
 */
export function calculateConvergence(temporalVariance, scale = 1) {
  return 1 / (1 + Number(temporalVariance ?? 0) / scale);
}

/**
 * Normalize DNA magnitude to 0-1 range
 * @param {number} magnitude - Raw DNA magnitude (vector length)
 * @param {number} maxMagnitude - Maximum expected magnitude
 * @returns {number} Normalized magnitude (0-1)
 */
export function normalizeMagnitude(magnitude, maxMagnitude = 8) {
  return clamp01(Number(magnitude ?? 0) / maxMagnitude);
}

/**
 * Classify maturity into human-readable state
 * @param {number} maturity - Maturity score (0-1)
 * @returns {string} Maturity state
 */
export function classifyMaturity(maturity) {
  if (maturity >= 0.90) return "saturated";
  if (maturity >= 0.75) return "mature";
  if (maturity >= 0.60) return "stable";
  if (maturity >= 0.30) return "growing";
  return "seed";
}

/**
 * Calculate DNA maturity from historical DNA vectors
 * 
 * Maturity = normalizedMagnitude × convergence
 * 
 * Where:
 * - normalizedMagnitude: DNA capability (vector length)
 * - convergence: DNA stability (inverse of temporal variance)
 * 
 * @param {Array<Object>} dnaHistory - DNA history entries
 * @param {Object} options - Calculation options
 * @param {number} options.windowSize - Number of recent entries to analyze
 * @param {number} options.varianceScale - Scale factor for variance convergence
 * @param {number} options.maxMagnitude - Maximum expected DNA magnitude
 * @returns {Object} Complete maturity information
 */
export function calculateDNAMaturityFromHistory(
  dnaHistory = [],
  {
    windowSize = 5,
    varianceScale = 1,
    maxMagnitude = 8,
  } = {}
) {
  const recent =
    dnaHistory
      .filter((item) => item?.vector)
      .slice(-windowSize);

  if (recent.length < 2) {
    return {
      maturity: 0,
      percent: 0,
      state: "seed",
      sampleSize: recent.length,
      reason: "not enough dna history",
      magnitude: 0,
      normalizedMagnitude: 0,
      temporalVariance: 1,
      convergence: 0,
      currentTraitScores: {},
    };
  }

  const snapshots =
    recent.map((item) => {
      const traitScores =
        calculateTraitScores(item.vector);

      return {
        at: item.at,
        reason: item.reason,
        traitScores,
        vector: traitScoresToVector(traitScores),
        magnitude: calculateCellScore(traitScores),
      };
    });

  const current = snapshots.at(-1);

  const temporalVariance =
    calculateTemporalVariance(
      snapshots.map((item) => item.vector)
    );

  const convergence =
    calculateConvergence(
      temporalVariance,
      varianceScale
    );

  const normalizedMagnitude =
    normalizeMagnitude(
      current.magnitude,
      maxMagnitude
    );

  const maturity =
    clamp01(
      normalizedMagnitude * convergence
    );

  return {
    maturity,
    percent: Math.round(maturity * 100),
    state: classifyMaturity(maturity),
    sampleSize: snapshots.length,
    magnitude: current.magnitude,
    normalizedMagnitude,
    temporalVariance,
    convergence,
    currentTraitScores: current.traitScores,
  };
}
