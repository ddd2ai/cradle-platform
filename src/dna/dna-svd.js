// src/dna/dna-svd.js

function dot(a, b) {
  return a.reduce(
    (sum, value, index) => sum + value * b[index],
    0
  );
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
  const length = norm(vector);

  if (length === 0) {
    return vector.map(() => 0);
  }

  return vector.map((value) => value / length);
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function transpose(matrix) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  return Array.from({ length: cols }, (_, col) =>
    Array.from({ length: rows }, (_, row) =>
      matrix[row][col]
    )
  );
}

export function rank1SVD(matrix, iterations = 30) {
  const cols = matrix[0]?.length ?? 0;

  if (matrix.length === 0 || cols === 0) {
    return {
      sigma: 0,
      u: [],
      v: [],
    };
  }

  const matrixT = transpose(matrix);

  let v = normalize(
    Array.from({ length: cols }, () => 1)
  );

  for (let i = 0; i < iterations; i++) {
    const av = multiplyMatrixVector(matrix, v);
    const atav = multiplyMatrixVector(matrixT, av);

    v = normalize(atav);
  }

  const av = multiplyMatrixVector(matrix, v);
  const sigma = norm(av);

  const u =
    sigma === 0
      ? av.map(() => 0)
      : av.map((value) => value / sigma);

  return {
    sigma,
    u,
    v,
  };
}
