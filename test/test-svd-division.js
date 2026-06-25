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

const matrix =
  dnaVectorToMatrix(dnaVector);

const plan =
  createDivisionPlanFromMatrix(matrix, {
    parentId: "cell-001",
    childId: "cell-002",
  });

console.log(JSON.stringify(plan, null, 2));