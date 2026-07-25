import assert from "assert";
import {
  calculateConvergence,
  calculateDNAMaturityFromHistory,
  calculateTemporalVariance,
  classifyMaturity,
  normalizeMagnitude,
  resolveDominantTrait,
} from "../src/dna/dna-maturity.js";

const empty = calculateDNAMaturityFromHistory([]);
assert.equal(empty.value, 0);
assert.equal(empty.maturity, 0);
assert.equal(empty.state, "seed");
assert.equal(empty.normalizedMagnitude, 0);
assert.equal(empty.temporalVariance, 1);
assert.equal(empty.convergence, 0);
assert.equal(empty.sampleSize, 0);
assert.equal(empty.dominantTrait, null);

const single = calculateDNAMaturityFromHistory([
  { vector: createVector({ CREATION: 0.8 }) },
]);
assert.equal(single.sampleSize, 1);
assert.equal(single.state, "seed");
assert.equal(single.dominantTrait, null);

const history = [
  { vector: createVector({ CREATION: 0.8, DECISION: 0.2 }) },
  { vector: createVector({ CREATION: 0.7, DECISION: 0.3 }) },
  { vector: createVector({ CREATION: 0.9, DECISION: 0.4 }) },
];
const maturity = calculateDNAMaturityFromHistory(history, {
  windowSize: 5,
  varianceScale: 1,
  maxMagnitude: 1,
});

assert.equal(maturity.sampleSize, 3);
assert.equal(maturity.dominantTrait, "CREATION");
assert.equal(maturity.value, maturity.maturity);
assert.equal(maturity.temporalVariance.toFixed(6), "0.013333");
assert.equal(maturity.convergence.toFixed(4), "0.9868");
assert.equal(maturity.normalizedMagnitude.toFixed(3), "0.985");
assert.equal(maturity.maturity.toFixed(4), "0.9719");

assert.equal(calculateTemporalVariance([[1, 0], [0, 1]]), 0.5);
assert.equal(calculateConvergence(0.0318).toFixed(4), "0.9692");
assert.equal(normalizeMagnitude(4, 8), 0.5);

assert.equal(classifyMaturity(0.2999), "seed");
assert.equal(classifyMaturity(0.3000), "growing");
assert.equal(classifyMaturity(0.5999), "growing");
assert.equal(classifyMaturity(0.6000), "stable");
assert.equal(classifyMaturity(0.7499), "stable");
assert.equal(classifyMaturity(0.7500), "mature");
assert.equal(classifyMaturity(0.8999), "mature");
assert.equal(classifyMaturity(0.9000), "saturated");

assert.equal(resolveDominantTrait([]), null);
assert.equal(resolveDominantTrait([0.1, 0.2, 0.3]), "DECOMPOSITION");

console.log("DNA maturity model tests passed");

function createVector(scores = {}) {
  const vector = {};

  for (const [trait, score] of Object.entries(scores)) {
    vector[trait] = {
      strength: score,
      stability: 1,
      plasticity: 1,
      fitness: 1,
    };
  }

  return vector;
}
