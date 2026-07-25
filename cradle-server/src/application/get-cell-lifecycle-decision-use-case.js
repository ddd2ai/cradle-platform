import { ApiError } from "../api/api-error.js";

export class GetCellLifecycleDecisionUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({
    cellId,
    hasComplementaryCell = false,
    recentFailureRate = 0,
  }) {
    const cell = this.engine.getCell(cellId);

    if (!cell) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${cellId} was not found`,
        details: { cellId },
      });
    }

    const profile = await cell.getProfile();
    const decision = await cell.getLifecycleDecision({
      hasComplementaryCell,
      recentFailureRate,
    });

    return {
      cellId,
      status: profile.status ?? "unknown",
      decision: toLifecycleDecisionDto(decision),
    };
  }
}

function toLifecycleDecisionDto(decision = {}) {
  return {
    action: decision.action ?? "stay",
    reason:
      decision.reasonCode ??
      decision.detail?.reasonCode ??
      normalizeLegacyReason(decision.reason),
    crossTraitVariance:
      decision.crossTraitVariance ??
      decision.detail?.crossTraitVariance ??
      0,
    recentFailureRate:
      decision.recentFailureRate ??
      decision.detail?.recentFailureRate ??
      0,
    complementaryCellId:
      decision.complementaryCellId ??
      decision.detail?.complementaryCellId ??
      null,
  };
}

function normalizeLegacyReason(reason) {
  const reasons = {
    "not enough dna history": "insufficient_samples",
    "dna vector is unstable": "high_temporal_variance",
    "recent artifact execution failures detected": "high_failure_rate",
    "cell is still growing": "maturity_below_threshold",
    "cell is mature, stable, powerful, and specialized": "stable_specialization",
    "cell is stable and generalized, with complementary cell available":
      "stable_generalization_with_complement",
    "cell is stable but not ready for structural change": "normal_growth",
  };

  return reasons[reason] ?? "normal_growth";
}
