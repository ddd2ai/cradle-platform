// src/dna/dna-matrix.js

export const DNA_TRAITS = [
  "PERCEPTION",
  "DECISION",
  "DECOMPOSITION",
  "LEARNING",
  "COLLABORATION",
  "CREATION",
  "EVOLUTION",
  "REFLECTION",
];

export const DNA_FACTORS = [
  "strength",
  "stability",
  "plasticity",
  "fitness",
];

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value ?? 0)));
}

export function dnaVectorToMatrix(dnaVector = {}) {
  return DNA_TRAITS.map((trait) =>
    DNA_FACTORS.map((factor) =>
      Number(dnaVector?.[trait]?.[factor] ?? 0)
    )
  );
}

export function matrixToDNAVector(matrix = []) {
  const vector = {};

  for (let i = 0; i < DNA_TRAITS.length; i++) {
    const trait = DNA_TRAITS[i];

    vector[trait] = {};

    for (let j = 0; j < DNA_FACTORS.length; j++) {
      const factor = DNA_FACTORS[j];

      vector[trait][factor] = clamp01(
        matrix?.[i]?.[j] ?? 0
      );
    }
  }

  return vector;
}
