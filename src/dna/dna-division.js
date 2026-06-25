// src/dna/dna-division.js

import {
  DNA_TRAITS,
  DNA_FACTORS,
  clamp01,
  matrixToDNAVector,
} from "./dna-matrix.js";

import {
  rank1SVD,
} from "./dna-svd.js";

function topItems(labels, values, minValue = 0.35, limit = 3) {
  return labels
    .map((label, index) => ({
      name: label,
      value: Math.abs(values[index] ?? 0),
    }))
    .filter((item) => item.value >= minValue)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function normalizeByMax(value, max) {
  if (!max || max <= 0) return 0;
  return value / max;
}

function inferRoleName(dominantTraits = []) {
  const primary = dominantTraits[0]?.name;

  if (primary === "CREATION") return "Creation Cell";
  if (primary === "DECOMPOSITION") return "Decomposition Cell";
  if (primary === "COLLABORATION") return "Collaboration Cell";
  if (primary === "PERCEPTION") return "Perception Cell";
  if (primary === "DECISION") return "Decision Cell";
  if (primary === "EVOLUTION") return "Evolution Cell";
  if (primary === "REFLECTION") return "Reflection Cell";
  if (primary === "LEARNING") return "Learning Cell";

  return "Specialized Cell";
}

const MUTATION_SEED_A = 12.9898;
const MUTATION_SEED_B = 78.233;
const MUTATION_SCALE = 43758.5453;

function deterministicMutation(i, j, mutationRate) {
  const seed =
    Math.sin(
      (i + 1) * MUTATION_SEED_A +
      (j + 1) * MUTATION_SEED_B
    ) * MUTATION_SCALE;

  const fraction =
    seed - Math.floor(seed);

  return (fraction - 0.5) * mutationRate;
}

export function createDivisionPlanFromMatrix(matrix, {
  parentId,
  childId,
  minTraitLoad = 0.38,
  minFactorLoad = 0.2,
  inheritRate = 0.88,
  mutationRate = 0.03,
  parentAttenuationRate = 0.12,
} = {}) {
  const {
    sigma,
    u,
    v,
  } = rank1SVD(matrix);

  const dominantTraits = topItems(DNA_TRAITS, u, minTraitLoad, 3);
  const dominantFactors = topItems(DNA_FACTORS, v, minFactorLoad, 4);
  const maxTrait = dominantTraits[0]?.value ?? 1;
  const maxFactor = dominantFactors[0]?.value ?? 1;

  const childBaseRate = 0.55;
  const childSpecializationRate = 0.45;

  const childMatrix = matrix.map((row, i) =>
    row.map((value, j) => {
      const traitLoad = normalizeByMax(
        Math.abs(u[i] ?? 0),
        maxTrait
      );

      const factorLoad = normalizeByMax(
        Math.abs(v[j] ?? 0),
        maxFactor
      );

      const inheritance =
        traitLoad * factorLoad;

      const mutation =
        deterministicMutation(i, j, mutationRate);

      return clamp01(
        value * (
          childBaseRate +
          childSpecializationRate * inheritance
        ) * inheritRate +
        mutation
      );
    })
  );

  const parentMatrix = matrix.map((row, i) =>
    row.map((value, j) => {
      const traitLoad = Math.abs(u[i] ?? 0);
      const factorLoad = Math.abs(v[j] ?? 0);

      const attenuation =
        traitLoad * factorLoad * parentAttenuationRate;

      return clamp01(
        value * (1 - attenuation)
      );
    })
  );

  const role =
    inferRoleName(dominantTraits);

  return {
    type: "svd-division",
    parentId,
    childId,
    sigma,
    role,
    reason:
      dominantTraits.length === 0
        ? "No dominant DNA axis detected."
        : `Dominant DNA axis: ${dominantTraits.map((item) => item.name).join(", ")}`,
    dominantTraits,
    dominantFactors,
    childDNAVector: matrixToDNAVector(childMatrix),
    parentDNAVector: matrixToDNAVector(parentMatrix),
    responsibilities: dominantTraits.map((trait) =>
      trait.name.toLowerCase()
    ),
    createdAt: new Date().toISOString(),
  };
}
