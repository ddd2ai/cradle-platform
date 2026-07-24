import assert from "assert";
import { CellDNAReadinessService } from "../src/cell/cell-dna-readiness-service.js";

const calls = [];
const vector = {
  CREATION: {
    strength: 0.9,
    stability: 0.8,
    plasticity: 0.4,
    fitness: 0.9,
  },
};
const cell = {
  id: "cell-dna",
  async readDNADefinition() {
    return [{ name: "CREATION" }, { name: "LEARNING" }];
  },
  async readDNAFactors() {
    return ["strength", "stability", "plasticity", "fitness"];
  },
  async readDNAVector() {
    return vector;
  },
  async writeDNAVector(nextVector) {
    calls.push({ type: "writeDNAVector", nextVector });
  },
  async appendDNAHistory(reason) {
    calls.push({ type: "appendDNAHistory", reason });
  },
  async readDNAHistory() {
    return [
      {
        vector: {
          CREATION: {
            strength: 0.9,
            stability: 0.8,
            plasticity: 0.4,
            fitness: 0.9,
          },
        },
      },
    ];
  },
  async readCellProfile() {
    return {
      id: "cell-dna",
      status: "idle",
      maturity: 3,
      generation: 2,
      parent: "parent-cell",
    };
  },
};

const service = new CellDNAReadinessService({ cell });

assert.equal(service.defaultDNAFactorValue("strength"), 0.5);
assert.equal(service.defaultDNAFactorValue("stability"), 0.7);
assert.equal(service.defaultDNAFactorValue("plasticity"), 0.3);
assert.equal(service.defaultDNAFactorValue("fitness"), 0.5);

await service.prepareDNAVector();

const writeCall = calls.find((call) => call.type === "writeDNAVector");
assert.equal(writeCall.nextVector.CREATION.strength, 0.9);
assert.deepEqual(writeCall.nextVector.LEARNING, {
  strength: 0.5,
  stability: 0.7,
  plasticity: 0.3,
  fitness: 0.5,
});
assert.equal(
  calls.find((call) => call.type === "appendDNAHistory").reason,
  "prepare"
);

const maturity = await service.getMaturityInfo();
assert.equal(typeof maturity.percent, "number");
assert.equal(await service.getMaturity(), maturity.percent);
assert.equal(await service.canDivide(), false);

await assert.rejects(
  () => service.assertCanDivide(),
  /not mature enough to divide/
);

const rank = await service.getDNARank();
assert.equal(rank.dominantDNA, "CREATION");
assert.equal(typeof rank.scores.LEARNING, "number");
assert.equal(typeof rank.score, "number");

const evolution = await service.getEvolutionInfo();
assert.equal(evolution.id, "cell-dna");
assert.equal(evolution.generation, 2);
assert.equal(evolution.parent, "parent-cell");
assert.equal(typeof evolution.dna.CRE, "number");

assert.throws(
  () => new CellDNAReadinessService(),
  /requires cell/
);

console.log("CellDNAReadinessService tests passed");
