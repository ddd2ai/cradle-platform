// test/test-svd-division.js

import {
  dnaVectorToMatrix,
} from "../src/dna/dna-matrix.js";

import {
  createDivisionPlanFromMatrix,
} from "../src/dna/dna-division.js";

const dnaVector = {
  PERCEPTION: {
    strength: 0.4,
    stability: 0.6,
    plasticity: 0.4,
    fitness: 0.5,
  },
  DECISION: {
    strength: 0.5,
    stability: 0.6,
    plasticity: 0.4,
    fitness: 0.5,
  },
  DECOMPOSITION: {
    strength: 0.7,
    stability: 0.7,
    plasticity: 0.4,
    fitness: 0.8,
  },
  LEARNING: {
    strength: 0.4,
    stability: 0.5,
    plasticity: 0.7,
    fitness: 0.5,
  },
  COLLABORATION: {
    strength: 0.7,
    stability: 0.6,
    plasticity: 0.5,
    fitness: 0.7,
  },
  CREATION: {
    strength: 0.95,
    stability: 0.8,
    plasticity: 0.4,
    fitness: 0.95,
  },
  EVOLUTION: {
    strength: 0.4,
    stability: 0.5,
    plasticity: 0.6,
    fitness: 0.5,
  },
  REFLECTION: {
    strength: 0.5,
    stability: 0.6,
    plasticity: 0.5,
    fitness: 0.6,
  },
};

console.log("=== DNA Division Plan Test ===\n");

const matrix =
  dnaVectorToMatrix(dnaVector);

const plan =
  createDivisionPlanFromMatrix(matrix, {
    parentId: "cell-001",
    childId: "cell-002",
  });

console.log("✅ DNA Division Plan created successfully\n");
console.log(JSON.stringify(plan, null, 2));

// 驗證 Planning 是 Pure Function
console.log("\n=== Test: Planning is Pure ===\n");

const matrix2 = dnaVectorToMatrix(dnaVector);
const plan2 = createDivisionPlanFromMatrix(matrix2, {
  parentId: "cell-001",
  childId: "cell-002",
});

// 驗證兩次規劃產生相同結果
console.assert(
  JSON.stringify(plan) === JSON.stringify(plan2),
  "Planning should produce identical results for same input"
);

console.log("✅ Planning is pure (same input produces same output)\n");
