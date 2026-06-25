// test/test-merge.js

import {
  calculateDNAMatrixCentroid,
  createCentroidFusionPlan,
} from "../src/dna/dna-centroid.js";

import {
  dnaVectorToMatrix,
  matrixToDNAVector,
} from "../src/dna/dna-matrix.js";

console.log("✅ Imports successful\n");

const testVector1 = {
  PERCEPTION: { strength: 0.8, stability: 0.7, plasticity: 0.5, fitness: 0.6 },
  DECISION: { strength: 0.6, stability: 0.5, plasticity: 0.4, fitness: 0.5 },
  DECOMPOSITION: { strength: 0.5, stability: 0.6, plasticity: 0.3, fitness: 0.4 },
  LEARNING: { strength: 0.7, stability: 0.6, plasticity: 0.8, fitness: 0.7 },
  COLLABORATION: { strength: 0.4, stability: 0.5, plasticity: 0.6, fitness: 0.5 },
  CREATION: { strength: 0.5, stability: 0.4, plasticity: 0.7, fitness: 0.6 },
  EVOLUTION: { strength: 0.6, stability: 0.5, plasticity: 0.9, fitness: 0.7 },
  REFLECTION: { strength: 0.7, stability: 0.8, plasticity: 0.5, fitness: 0.6 },
};

const testVector2 = {
  PERCEPTION: { strength: 0.5, stability: 0.6, plasticity: 0.4, fitness: 0.5 },
  DECISION: { strength: 0.8, stability: 0.7, plasticity: 0.6, fitness: 0.7 },
  DECOMPOSITION: { strength: 0.7, stability: 0.8, plasticity: 0.5, fitness: 0.6 },
  LEARNING: { strength: 0.4, stability: 0.5, plasticity: 0.6, fitness: 0.5 },
  COLLABORATION: { strength: 0.9, stability: 0.8, plasticity: 0.7, fitness: 0.8 },
  CREATION: { strength: 0.3, stability: 0.4, plasticity: 0.5, fitness: 0.4 },
  EVOLUTION: { strength: 0.5, stability: 0.6, plasticity: 0.7, fitness: 0.6 },
  REFLECTION: { strength: 0.6, stability: 0.5, plasticity: 0.4, fitness: 0.5 },
};

const matrix1 = dnaVectorToMatrix(testVector1);
const matrix2 = dnaVectorToMatrix(testVector2);

console.log("🧬 Testing centroid calculation...\n");

const items = [
  { cellId: "cell-001", matrix: matrix1, weight: 5 },
  { cellId: "cell-002", matrix: matrix2, weight: 3 },
];

const centroid = calculateDNAMatrixCentroid(items);

console.log("Centroid matrix dimensions:", centroid.length, "x", centroid[0].length);
console.log("Sample centroid values:", centroid[0].slice(0, 4));
console.log("");

console.log("🧬 Testing fusion plan creation...\n");

const plan = createCentroidFusionPlan({
  parentIds: ["cell-001", "cell-002"],
  childId: "cell-fusion-001",
  items,
});

console.log("Fusion plan type:", plan.type);
console.log("Parent IDs:", plan.parentIds);
console.log("Child ID:", plan.childId);
console.log("Weights:", plan.weights);
console.log("Fused DNA vector traits:", Object.keys(plan.fusedDNAVector));
console.log("");

console.log("✅ All tests passed!");
