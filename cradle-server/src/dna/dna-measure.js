// src/dna/dna-measure.js

export function calculateTraitValue(
  factors = {}
) {

  const strength =
    Number(factors.strength ?? 0);

  const stability =
    Math.max(
      Number(factors.stability ?? 0),
      0.01
    );

  const fitness =
    Number(factors.fitness ?? 0);

  const plasticity =
    Math.max(
      Number(factors.plasticity ?? 0),
      0.01
    );

  return (
    strength *
    (
      fitness /
      (
        plasticity /
        Math.sqrt(stability)
      )
    )
  );
}

export function calculateVectorLength(
  vector = []
) {

  return Math.sqrt(
    vector.reduce(
      (sum, value) =>
        sum + value * value,
      0
    )
  );
}

export function calculateCellScore(
  traitScores = {}
) {

  return calculateVectorLength(
    Object.values(traitScores)
      .map(Number)
  );
}
