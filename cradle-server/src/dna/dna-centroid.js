// src/dna/dna-centroid.js

import {
  matrixToDNAVector,
  clamp01,
} from "./dna-matrix.js";

export function calculateDNAMatrixCentroid(items = []) {
  const validItems = items.filter((item) =>
    Array.isArray(item.matrix) &&
    item.matrix.length > 0
  );

  if (validItems.length === 0) {
    throw new Error("No DNA matrices to calculate centroid.");
  }

  const rows = validItems[0].matrix.length;
  const cols = validItems[0].matrix[0]?.length ?? 0;

  const totalWeight = validItems.reduce((sum, item) => {
    return sum + Math.max(Number(item.weight ?? 1), 0.01);
  }, 0);

  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => {
      const value =
        validItems.reduce((sum, item) => {
          const weight = Math.max(Number(item.weight ?? 1), 0.01);
          return sum + Number(item.matrix?.[i]?.[j] ?? 0) * weight;
        }, 0) / totalWeight;

      return clamp01(value);
    })
  );
}

export function createCentroidFusionPlan({
  parentIds = [],
  childId,
  items = [],
} = {}) {
  const centroidMatrix =
    calculateDNAMatrixCentroid(items);

  return {
    type: "centroid-fusion",
    parentIds,
    childId,
    fusedDNAVector: matrixToDNAVector(centroidMatrix),
    weights: items.map((item) => ({
      cellId: item.cellId,
      weight: item.weight,
    })),
    createdAt: new Date().toISOString(),
  };
}
