import {
  calculateTraitValue,
  calculateCellScore,
} from "../dna/dna-measure.js";
import {
  calculateDNAMaturityFromHistory,
} from "../dna/dna-maturity.js";

const TRAIT_NAMES = Object.freeze([
  "PERCEPTION",
  "DECISION",
  "DECOMPOSITION",
  "LEARNING",
  "COLLABORATION",
  "CREATION",
  "EVOLUTION",
  "REFLECTION",
]);

const TRAIT_SHORT_NAMES = Object.freeze({
  PERCEPTION: "PER",
  DECISION: "DEC",
  DECOMPOSITION: "DEP",
  LEARNING: "LEA",
  COLLABORATION: "COL",
  CREATION: "CRE",
  EVOLUTION: "EVO",
  REFLECTION: "REF",
});

export class CellDNAReadinessService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellDNAReadinessService requires cell");
    }

    this.cell = cell;
  }

  async prepareDNAVector() {
    const definitions = await this.cell.readDNADefinition();
    const factors = await this.cell.readDNAFactors();

    const existing = await this.cell.readDNAVector();
    const vector = existing ?? {};

    for (const definition of definitions) {
      vector[definition.name] ??= {};

      for (const factor of factors) {
        vector[definition.name][factor] ??= this.defaultDNAFactorValue(factor);
      }
    }

    await this.cell.writeDNAVector(vector);
    await this.cell.appendDNAHistory("prepare");
  }

  defaultDNAFactorValue(factor) {
    if (factor === "strength") return 0.5;
    if (factor === "stability") return 0.7;
    if (factor === "plasticity") return 0.3;
    return 0.5;
  }

  async getMaturity() {
    const maturity = await this.getMaturityInfo();
    return maturity.percent;
  }

  async getMaturityInfo() {
    const history = await this.cell.readDNAHistory();

    return calculateDNAMaturityFromHistory(history, {
      windowSize: 5,
      varianceScale: 1,
      maxMagnitude: 8,
    });
  }

  async mature() {
    return await this.getMaturityInfo();
  }

  async canDivide() {
    const maturity = await this.getMaturityInfo();

    return this._passesDivisionReadiness(maturity);
  }

  async assertCanDivide() {
    const maturity = await this.getMaturityInfo();

    if (this._passesDivisionReadiness(maturity)) {
      return maturity;
    }

    throw new Error(
      [
        `Cell ${this.cell.id} is not mature enough to divide.`,
        "",
        `Maturity           : ${maturity.percent}%`,
        `State              : ${maturity.state}`,
        `Sample Size        : ${maturity.sampleSize}`,
        `Temporal Variance  : ${maturity.temporalVariance.toFixed(6)}`,
        `Convergence        : ${maturity.convergence.toFixed(4)}`,
        `NormalizedMagnitude: ${maturity.normalizedMagnitude.toFixed(4)}`,
        "",
        "Required:",
        "- sampleSize >= 5",
        "- maturity >= 75%",
        "- temporalVariance <= 0.08",
        "- normalizedMagnitude >= 0.60",
      ].join("\n")
    );
  }

  async getEvolutionInfo() {
    const profile = await this.cell.readCellProfile();
    const dnaVector = await this.cell.readDNAVector();
    const dna = {};

    if (dnaVector) {
      for (const [trait, shortName] of Object.entries(TRAIT_SHORT_NAMES)) {
        dna[shortName] = calculateTraitValue(dnaVector[trait] ?? {});
      }
    }

    return {
      id: profile?.id,
      status: profile?.status,
      maturity: Number(profile?.maturity ?? 0),
      generation: Number(profile?.generation ?? 1),
      parent: profile?.parent ?? null,
      dna,
    };
  }

  async getDNARank() {
    const dna = await this.cell.readDNAVector();
    const scores = {};

    for (const trait of TRAIT_NAMES) {
      const value = dna?.[trait];

      if (!value) {
        scores[trait] = 0;
        continue;
      }

      scores[trait] = calculateTraitValue(value);
    }

    const dominant =
      Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0];

    const cellScore = calculateCellScore(scores);

    return {
      dominantDNA: dominant[0],
      score: cellScore,
      scores,
    };
  }

  _passesDivisionReadiness(maturity) {
    return (
      maturity.sampleSize >= 5 &&
      maturity.maturity >= 0.75 &&
      maturity.temporalVariance <= 0.08 &&
      maturity.normalizedMagnitude >= 0.60
    );
  }
}
