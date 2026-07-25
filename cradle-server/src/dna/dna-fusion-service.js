import {
  dnaVectorToMatrix,
  matrixToDNAVector,
  DNA_TRAITS,
  DNA_FACTORS,
} from "./dna-matrix.js";

import {
  calculateDNAMatrixCentroid,
} from "./dna-centroid.js";

import {
  calculateTraitScores,
  calculateDNAMaturityFromHistory,
} from "./dna-maturity.js";

import {
  calculateCellScore,
} from "./dna-measure.js";

import {
  findDominantTrait,
} from "./dna-lifecycle.js";

export class DNAFusionService {
  async createPlan({
    parentCells,
    childId,
    parentWeights = {},
  } = {}) {
    this.validateInput({
      parentCells,
      childId,
    });

    const items = [];

    for (const cell of parentCells) {
      const vector =
        await cell.readDNAVector();

      if (!vector) {
        throw new Error(
          `DNAFusionService: cell ${cell.id} has no DNA vector`
        );
      }

      items.push({
        cellId: cell.id,
        matrix: dnaVectorToMatrix(vector),
        weight: this.resolveWeight(
          parentWeights[cell.id]
        ),
      });
    }

    const fusedMatrix =
      calculateDNAMatrixCentroid(items);

    // 唯一正確的 Matrix → DNA Vector 轉換
    const fusedVector =
      matrixToDNAVector(fusedMatrix);

    const traitScores =
      calculateTraitScores(fusedVector);

    const cellScore =
      calculateCellScore(traitScores);

    const dominantTrait =
      findDominantTrait(traitScores);

    const maturity =
      await this.calculateAverageMaturity(
        parentCells
      );

    const dominantTraits =
      this.resolveDominantTraits(
        traitScores
      );

    const dominantFactors =
      this.resolveDominantFactors(
        fusedVector,
        dominantTraits
      );

    const role =
      this.resolveRole({
        maturity,
        dominantTrait,
      });

    const parentIds =
      parentCells.map(
        cell => cell.id
      );

    return {
      type: "dna-fusion",
      parentCellIds: parentIds,
      childCellId: childId,

      fusedMatrix,
      fusedVector,

      maturity,
      cellScore,
      role,

      dominantTraits,
      dominantFactors,

      parentWeights:
        items.map(item => ({
          cellId: item.cellId,
          weight: item.weight,
        })),

      reason:
        `Fused from ${parentIds.join(", ")} ` +
        `with maturity ${maturity.toFixed(2)} ` +
        `and cell score ${cellScore.toFixed(2)}`,

      createdAt:
        new Date().toISOString(),
    };
  }

  async applyPlan({
    childCell,
    parentCells,
    plan,
  } = {}) {
    if (!childCell) {
      throw new Error(
        "DNAFusionService: childCell is required"
      );
    }

    if (
      !plan ||
      plan.type !== "dna-fusion" ||
      !plan.fusedVector
    ) {
      throw new Error(
        "DNAFusionService: invalid DNA fusion plan"
      );
    }

    await childCell.writeDNAVector(
      plan.fusedVector
    );

    const generations =
      await Promise.all(
        parentCells.map(async cell => {
          const profile =
            await cell.readCellProfile();

          return Number(
            profile?.generation ?? 1
          );
        })
      );

    const childProfile =
      await childCell.readCellProfile();

    await childCell.writeCellProfile({
      ...childProfile,
      generation:
        Math.max(...generations) + 1,

      role: plan.role,

      updatedAt:
        new Date().toISOString(),
    });

    // Child prepare() 已可能寫入 seed history，
    // 這裡只在 DNA 真正變更後追加。
    await childCell
      .appendDNAHistoryIfChanged(
        `fusion from ${plan.parentCellIds.join(", ")}`
      );
  }

  async calculateAverageMaturity(
    parentCells
  ) {
    const maturities = [];

    for (const cell of parentCells) {
      const history =
        await cell.readDNAHistory();

      if (history.length === 0) {
        continue;
      }

      const info =
        calculateDNAMaturityFromHistory(
          history
        );

      maturities.push(
        Number(info.maturity ?? 0)
      );
    }

    if (maturities.length === 0) {
      return 0;
    }

    return (
      maturities.reduce(
        (sum, value) =>
          sum + value,
        0
      ) /
      maturities.length
    );
  }

  resolveDominantTraits(
    traitScores,
    limit = 3
  ) {
    return Object
      .entries(traitScores)
      .map(([trait, score]) => ({
        trait,
        score: Number(score ?? 0),
      }))
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, limit)
      .map(item => item.trait);
  }

  resolveDominantFactors(
    fusedVector,
    dominantTraits,
    threshold = 0.7
  ) {
    const result = [];

    for (
      const trait of dominantTraits
    ) {
      for (
        const factor of DNA_FACTORS
      ) {
        const value =
          Number(
            fusedVector
              ?.[trait]
              ?.[factor] ?? 0
          );

        if (value >= threshold) {
          result.push(
            `${trait}.${factor}`
          );
        }
      }
    }

    return result;
  }

  resolveRole({
    maturity,
    dominantTrait,
  }) {
    const trait =
      dominantTrait?.trait ??
      "Balanced";

    if (maturity >= 0.75) {
      return `Mature ${trait}`;
    }

    if (maturity >= 0.40) {
      return `Growing ${trait}`;
    }

    return `Seed ${trait}`;
  }

  resolveWeight(value) {
    const weight =
      Number(value ?? 1);

    if (
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      return 1;
    }

    return weight;
  }

  validateInput({
    parentCells,
    childId,
  }) {
    if (
      !Array.isArray(parentCells) ||
      parentCells.length < 2
    ) {
      throw new Error(
        "DNAFusionService: parentCells must contain at least 2 cells"
      );
    }

    const parentIds =
      parentCells.map(
        cell => cell?.id
      );

    if (
      parentIds.some(
        id =>
          typeof id !== "string" ||
          id.trim() === ""
      )
    ) {
      throw new Error(
        "DNAFusionService: every parent cell must have an id"
      );
    }

    if (
      new Set(parentIds).size !==
      parentIds.length
    ) {
      throw new Error(
        "DNAFusionService: parent cells must be unique"
      );
    }

    if (
      typeof childId !== "string" ||
      childId.trim() === ""
    ) {
      throw new Error(
        "DNAFusionService: childId is required"
      );
    }

    if (
      parentIds.includes(childId)
    ) {
      throw new Error(
        "DNAFusionService: childId must not equal a parent id"
      );
    }
  }
}
