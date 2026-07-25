export const HEARTBEAT_ACTIONS = Object.freeze({
  STAY: "stay",
  REPAIR: "repair",
  DIVIDE: "divide",
  FUSE: "fuse",
});

export class HeartbeatLifecyclePolicy {
  constructor({ engine } = {}) {
    if (!engine) {
      throw new Error("HeartbeatLifecyclePolicy requires engine");
    }

    this.engine = engine;
  }

  async evaluate(proposal) {
    const action = proposal.action;
    const reasons = [];
    const warnings = [];

    if (action === HEARTBEAT_ACTIONS.STAY) {
      return this._decision({ action, allowed: true, riskLevel: "low", requiresApproval: false });
    }

    if (action === HEARTBEAT_ACTIONS.REPAIR) {
      if (!this.engine.hasCell(proposal.sourceCellId)) {
        reasons.push(`source cell not found: ${proposal.sourceCellId}`);
      }

      if (proposal.repairType === "artifact") {
        if (!proposal.artifactId) {
          reasons.push("artifact repair requires artifactId");
        }
      } else if (proposal.repairType === "dna") {
        reasons.push("DNA repair strategy is not implemented");
      } else if (proposal.repairType === "environment") {
        reasons.push("environment repair strategy is not implemented");
      } else {
        reasons.push("repair target is unresolved");
      }

      return this._decision({
        action,
        allowed: reasons.length === 0,
        reasons,
        warnings,
        riskLevel: "medium",
        requiresApproval: false,
      });
    }

    if (action === HEARTBEAT_ACTIONS.DIVIDE) {
      const cell = this.engine.getCell(proposal.sourceCellId);

      if (!cell) {
        reasons.push(`source cell not found: ${proposal.sourceCellId}`);
      }

      if (!proposal.suggestedChildId) {
        reasons.push("suggestedChildId is required for divide");
      } else if (this.engine.hasCell(proposal.suggestedChildId)) {
        reasons.push(`suggested child already exists: ${proposal.suggestedChildId}`);
      }

      const maturity = proposal.evidence?.find?.((item) => item.type === "maturity")?.value;
      if (maturity && maturity.maturity < 0.75) {
        reasons.push(`divide readiness failed: maturity=${Math.round(maturity.maturity * 100)}%`);
      }

      return this._decision({
        action,
        allowed: reasons.length === 0,
        reasons,
        warnings,
        riskLevel: "high",
        requiresApproval: warnings.length > 0,
      });
    }

    if (action === HEARTBEAT_ACTIONS.FUSE) {
      if (!this.engine.hasCell(proposal.sourceCellId)) {
        reasons.push(`source cell not found: ${proposal.sourceCellId}`);
      }

      for (const targetId of proposal.targetCellIds || []) {
        if (!this.engine.hasCell(targetId)) {
          reasons.push(`target cell not found: ${targetId}`);
        }
      }

      if (!proposal.suggestedChildId) {
        reasons.push("suggestedChildId is required for fuse");
      } else if (this.engine.hasCell(proposal.suggestedChildId)) {
        reasons.push(`suggested fused child already exists: ${proposal.suggestedChildId}`);
      }

      return this._decision({
        action,
        allowed: reasons.length === 0,
        reasons,
        warnings,
        riskLevel: "high",
        requiresApproval: warnings.length > 0,
      });
    }

    return this._decision({
      action,
      allowed: false,
      reasons: [`unknown action: ${action}`],
      riskLevel: "high",
      requiresApproval: true,
    });
  }

  _decision({
    action,
    allowed,
    reasons = [],
    warnings = [],
    riskLevel,
    requiresApproval,
  }) {
    return {
      allowed,
      action,
      reasons,
      warnings,
      riskLevel,
      requiresApproval,
    };
  }
}
