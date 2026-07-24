import assert from "assert";
import {
  buildDnaMatrixRows,
  buildEvolutionRows,
  buildWatchStatusRows,
  buildWorkRows,
} from "../src/commands/colony-row-builders.js";

function createEngine() {
  const cell = {
    readInbox: async () => [{ content: "message" }],
    readTasks: async () => [
      { status: "pending" },
      { status: "done" },
    ],
    getEvolutionStatus: async () => ({
      totalThoughts: 5,
      unevolvedThoughts: 2,
      evolvedThoughts: 3,
      evolutionCount: 1,
      nextEvolutionIn: 4,
      lastEvolvedAt: "2026-07-24T10:00:00.000Z",
    }),
    getDNARank: async () => ({
      dominantDNA: "CREATION",
      score: 0.9876,
      scores: {
        PERCEPTION: 0.1,
        DECISION: 0.2,
        DECOMPOSITION: 0.3,
        LEARNING: 0.4,
        COLLABORATION: 0.5,
        CREATION: 0.6,
        EVOLUTION: 0.7,
        REFLECTION: 0.8,
      },
    }),
    getEvolutionInfo: async () => ({
      status: "active",
      generation: 2,
    }),
    getMaturityInfo: async () => ({
      percent: 80,
      state: "stable",
      temporalVariance: 0.01234,
      convergence: 0.987,
    }),
    getLifecycleDecision: async () => ({
      action: "stay",
    }),
    isActive: () => true,
  };

  return {
    inboxes: new Map(),
    cells: new Map([["cell-001", cell]]),
  };
}

const engine = createEngine();
const workRows = await buildWorkRows(engine);
assert.deepEqual(workRows, [
  {
    Cell: "cell-001",
    Inbox: 1,
    Tasks: 1,
    Action: "process",
  },
]);
assert.equal(engine.inboxes.get("cell-001").length, 1);

assert.deepEqual(await buildEvolutionRows(createEngine()), [
  {
    Cell: "cell-001",
    Thoughts: 5,
    Unevolved: 2,
    Evolved: 3,
    Evolutions: 1,
    Next: 4,
  },
]);

assert.deepEqual(await buildEvolutionRows(createEngine(), { includeLast: true }), [
  {
    Cell: "cell-001",
    Thoughts: 5,
    Unevolved: 2,
    Evolved: 3,
    Evolutions: 1,
    Next: 4,
    Last: "2026-07-24T10:00:00.000Z",
  },
]);

assert.deepEqual(await buildDnaMatrixRows(createEngine()), [
  {
    Cell: "cell-001",
    "Dominant DNA": "CREATION",
    Score: "0.99",
    PER: "0.10",
    DEC: "0.20",
    DEP: "0.30",
    LEA: "0.40",
    COL: "0.50",
    CRE: "0.60",
    EVO: "0.70",
    REF: "0.80",
  },
]);

assert.deepEqual(await buildWatchStatusRows(createEngine()), [
  {
    Cell: "cell-001",
    Status: "active",
    Active: "yes",
    Mature: "80%",
    Life: "stay",
    State: "stable",
    Var: "0.0123",
    Conv: "0.99",
    Gen: 2,
    Inbox: 0,
  },
]);

console.log("Colony row builder tests passed");
