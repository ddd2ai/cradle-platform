import {
  calculateCrossTraitVariance,
  findDominantTrait,
  decideCellLifecycle,
} from "../dna/dna-lifecycle.js";
import {
  resolveRepairTypeFromDecision,
} from "../lifecycle/repair-type.js";

export class CellLifecycleFacade {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellLifecycleFacade requires cell");
    }

    this.cell = cell;
  }

  async getLifecycleDecision({
    hasComplementaryCell = false,
    recentFailureRate = 0,
  } = {}) {
    const maturityInfo = await this.cell.getMaturityInfo();

    const traitScores =
      maturityInfo.currentTraitScores ?? {};

    const crossTraitVariance =
      calculateCrossTraitVariance(traitScores);

    const dominantTrait =
      findDominantTrait(traitScores);

    return decideCellLifecycle({
      maturityInfo,
      crossTraitVariance,
      dominantTrait,
      hasComplementaryCell,
      recentFailureRate,
    });
  }

  async observeCradle(snapshot) {
    const observedAt = new Date().toISOString();
    const selfSnapshot =
      snapshot?.cells?.find((cell) => cell.cellId === this.cell.id) ?? {};
    const artifactThreats =
      (selfSnapshot?.recentFailures ?? [])
        .filter(
          (threat) =>
            threat.type === "artifact-execution-failure" &&
            threat.artifactId
        );
    const maturity = await this.cell.getMaturityInfo().catch(() => null);
    const lifecycle = await this.getLifecycleDecision({
      recentFailureRate: artifactThreats.length > 0 ? 1 : 0,
      hasComplementaryCell: false,
    }).catch(() => ({
      action: "stay",
      confidence: "low",
      reason: "lifecycle decision unavailable",
    }));

    const findings = [];

    if ((selfSnapshot.threatCount ?? 0) > 0) {
      findings.push({
        type: "recent-failures",
        severity: "high",
        description: "Recent threat stimuli were observed for this cell.",
        evidence: selfSnapshot.recentFailures ?? [],
      });
    }

    if (lifecycle.action && lifecycle.action !== "stay") {
      findings.push({
        type: "lifecycle-signal",
        severity: lifecycle.action === "repair" ? "medium" : "high",
        description: lifecycle.reason ?? `Lifecycle suggests ${lifecycle.action}.`,
        evidence: lifecycle.detail ?? {},
      });
    }

    return {
      observationId: `observation-${this.cell.id}-${this.cell.formatTimestamp(new Date())}`,
      observedAt,
      observerCellId: this.cell.id,
      self: {
        lifecycleState: lifecycle.action ?? selfSnapshot.lifecycleState ?? null,
        maturity,
        stability: maturity?.convergence ?? null,
        recentFailures: selfSnapshot.recentFailures ?? [],
      },
      findings,
      candidateActions: [lifecycle.action ?? "stay"],
      lifecycleDecision: lifecycle,
    };
  }

  async proposeLifecycle({ observation, snapshot } = {}) {
    const decision = observation?.lifecycleDecision ?? {};
    const action = decision?.action ?? "stay";
    const latestArtifactThreat =
      observation?.self?.recentFailures
        ?.find(
          (threat) =>
            threat.type === "artifact-execution-failure" &&
            threat.artifactId
        ) ?? null;
    let repairType = null;
    let artifactId = null;
    let threatId = null;

    if (action === "repair") {
      if (latestArtifactThreat) {
        repairType = "artifact";
        artifactId = latestArtifactThreat.artifactId;
        threatId = latestArtifactThreat.threatId;
      } else {
        repairType = resolveRepairTypeFromDecision(decision);
      }
    }

    const createdAt = new Date().toISOString();
    const nextCellNumber =
      Math.max(
        0,
        ...(snapshot?.cells ?? [])
          .map((cell) => Number(String(cell.cellId).match(/cell-(\d+)/)?.[1] ?? 0))
      ) + 1;
    const suggestedChildId = `cell-${String(nextCellNumber).padStart(3, "0")}`;

    return {
      proposalId: `proposal-${this.cell.id}-${this.cell.formatTimestamp(new Date())}`,
      createdAt,
      sourceCellId: this.cell.id,
      action,
      repairType,
      artifactId,
      threatId,
      targetCellIds: [],
      suggestedChildId: action === "divide" || action === "fuse" ? suggestedChildId : null,
      reason: decision?.reason ?? "No lifecycle change proposed.",
      evidence: [
        {
          type: "observation",
          value: observation,
        },
        {
          type: "maturity",
          value: observation?.self?.maturity ?? null,
        },
        ...(latestArtifactThreat
          ? [{
              type: "artifact-execution-failure",
              value: latestArtifactThreat,
            }]
          : []),
      ],
      confidence: normalizeLifecycleConfidence(decision?.confidence),
      status: "pending",
    };
  }
}

function normalizeLifecycleConfidence(confidence) {
  if (typeof confidence === "number") {
    return confidence;
  }

  if (confidence === "high") {
    return 0.9;
  }

  if (confidence === "medium") {
    return 0.6;
  }

  return 0.3;
}
