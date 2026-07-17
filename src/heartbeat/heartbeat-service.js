import { CradleSnapshotService } from "./cradle-snapshot-service.js";
import { HeartbeatMode, HeartbeatModeStore } from "./heartbeat-mode.js";
import { HeartbeatLifecyclePolicy } from "./lifecycle-policy-service.js";
import { LifecycleExecutionService } from "./lifecycle-execution-service.js";
import { LifecycleProposalStore } from "./lifecycle-proposal-store.js";

export class HeartbeatService {
  constructor({
    engine,
    modeStore = new HeartbeatModeStore(),
    proposalStore = new LifecycleProposalStore(),
    snapshotService = null,
    policy = null,
    executionService = null,
    approvalService = null,
  } = {}) {
    if (!engine) {
      throw new Error("HeartbeatService requires engine");
    }

    this.engine = engine;
    this.modeStore = modeStore;
    this.proposalStore = proposalStore;
    this.snapshotService = snapshotService || new CradleSnapshotService({ engine });
    this.policy = policy || new HeartbeatLifecyclePolicy({ engine });
    this.executionService = executionService || new LifecycleExecutionService({ engine });
    this.approvalService = approvalService;
  }

  async beat() {
    const mode = await this.modeStore.getMode();
    const snapshot = await this.snapshotService.create();
    const observations = [];
    const records = [];

    for (const cell of this.engine.listCells()) {
      const observation = await cell.observeCradle(snapshot);
      observations.push(observation);

      const proposal = await cell.proposeLifecycle({ observation, snapshot });
      if (!proposal) {
        continue;
      }

      const policyDecision = await this.policy.evaluate(proposal);
      const proposalStatus =
        !policyDecision.allowed
          ? "blocked"
          : proposal.action === "stay"
            ? "completed"
            : "pending";
      const record = {
        proposal: {
          ...proposal,
          status: proposalStatus,
        },
        observation,
        policyDecision,
        mode,
        timestamps: {
          createdAt: new Date().toISOString(),
        },
      };

      records.push(record);
    }

    const selected = this.selectProposal(records);
    const saved = [];

    for (const record of records) {
      if (record !== selected) {
        saved.push(await this.proposalStore.save(record));
      }
    }

    if (!selected) {
      return {
        status: "completed",
        action: "stay",
        mode,
        snapshot,
        observations,
        saved,
      };
    }

    const handled = await this.handleProposal(selected, mode);
    saved.push(await this.proposalStore.save(handled.record));

    return {
      status: handled.record.proposal.status,
      action: handled.record.proposal.action,
      mode,
      snapshot,
      observations,
      selected: handled.record,
      saved,
    };
  }

  selectProposal(records) {
    const actionable = records.filter(
      (record) =>
        record.proposal.action !== "stay" &&
        record.policyDecision.allowed
    );

    if (actionable.length > 0) {
      return actionable.sort(this.compareProposalPriority)[0];
    }

    return records.find((record) => record.proposal.action === "stay") ?? null;
  }

  compareProposalPriority(a, b) {
    const rank = {
      repair: 1,
      fuse: 3,
      divide: 4,
      stay: 5,
    };

    const ar = rank[a.proposal.action] ?? 99;
    const br = rank[b.proposal.action] ?? 99;
    if (ar !== br) return ar - br;
    return (b.proposal.confidence ?? 0) - (a.proposal.confidence ?? 0);
  }

  async handleProposal(record, mode) {
    const { proposal, policyDecision } = record;

    if (!policyDecision.allowed) {
      return {
        record: {
          ...record,
          proposal: {
            ...proposal,
            status: "blocked",
            blockedAt: new Date().toISOString(),
          },
        },
      };
    }

    if (proposal.action === "stay") {
      return {
        record: {
          ...record,
          proposal: {
            ...proposal,
            status: "completed",
            completedAt: new Date().toISOString(),
          },
          executionResult: {
            status: "completed",
            result: "no-op",
          },
        },
      };
    }

    const needsApproval =
      mode === HeartbeatMode.MANUAL ||
      policyDecision.requiresApproval ||
      policyDecision.warnings.length > 0;

    if (needsApproval) {
      const approved = await this.approvalService?.requestApproval?.({
        proposal,
        policyDecision,
        mode,
      });

      if (!approved) {
        return {
          record: {
            ...record,
            userDecision: {
              approved: false,
              decidedAt: new Date().toISOString(),
            },
            proposal: {
              ...proposal,
              status: "rejected",
              rejectedAt: new Date().toISOString(),
              rejectionReason: "user-declined",
            },
          },
        };
      }
    }

    const executionResult = await this.executionService.execute({
      ...proposal,
      status: "executing",
    });

    return {
      record: {
        ...record,
        userDecision: needsApproval
          ? {
              approved: true,
              decidedAt: new Date().toISOString(),
            }
          : {
              approved: true,
              decidedAt: new Date().toISOString(),
              automatic: true,
            },
        executionResult,
        proposal: {
          ...proposal,
          status: executionResult.status === "completed" ? "completed" : executionResult.status,
          executingAt: executionResult.startedAt,
          completedAt: executionResult.completedAt,
          failedAt: executionResult.failedAt,
        },
      },
    };
  }
}
