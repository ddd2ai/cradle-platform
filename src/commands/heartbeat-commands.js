import { HeartbeatService } from "../heartbeat/heartbeat-service.js";
import { HeartbeatMode, HeartbeatModeStore } from "../heartbeat/heartbeat-mode.js";
import { LifecycleProposalStore } from "../heartbeat/lifecycle-proposal-store.js";
import { commandArgs } from "./command-input.js";

export function createHeartbeatCommands({
  heartbeatServiceFactory = ({ engine, approvalService }) =>
    new HeartbeatService({ engine, approvalService }),
  heartbeatModeStoreFactory = () => new HeartbeatModeStore(),
  lifecycleProposalStoreFactory = () => new LifecycleProposalStore(),
} = {}) {
  return [
    {
      name: "/heartbeat",

      match: (input) =>
        input === "/heartbeat",

      execute: async ({ engine }) => {
        const approvalService = createCliApprovalService({ engine });
        const result = await heartbeatServiceFactory({
          engine,
          approvalService,
        }).beat();

        renderHeartbeatResult(result);
      }
    },

    {
      name: "/tick",

      match: (input) =>
        input === "/tick",

      execute: async ({ engine }) => {
        await engine.tickAll();
      }
    },

    {
      name: "/heartbeat-mode",

      match: (input) =>
        input === "/heartbeat-mode" ||
        input.startsWith("/heartbeat-mode "),

      execute: async ({ input }) => {
        const store = heartbeatModeStoreFactory();
        const mode = commandArgs(input, "/heartbeat-mode");

        if (!mode) {
          console.log(`Heartbeat Mode: ${await store.getMode()}`);
          return;
        }

        if (!Object.values(HeartbeatMode).includes(mode)) {
          console.log("Usage: /heartbeat-mode <manual|automatic>");
          return;
        }

        const result = await store.setMode(mode);
        console.log("Heartbeat mode changed:");
        console.log(`${result.previous} → ${result.current}`);
      }
    },

    {
      name: "/proposals",

      match: (input) =>
        input === "/proposals" ||
        input.startsWith("/proposals "),

      execute: async ({ input }) => {
        const status = commandArgs(input, "/proposals") || null;
        const proposals = await lifecycleProposalStoreFactory().list({ status });

        if (proposals.length === 0) {
          console.log("No proposals found.");
          return;
        }

        for (const record of proposals.slice(0, 20)) {
          const proposal = record.proposal || {};
          console.log(`${proposal.proposalId}  ${proposal.status}  ${proposal.action}  ${proposal.sourceCellId}`);
        }
      }
    },
  ];
}

export function renderHeartbeatResult(result) {
  console.log("");
  console.log(`Heartbeat Mode: ${result.mode}`);
  console.log("");

  if (result.action === "stay" && result.blocked?.length > 0) {
    console.log("No executable proposal.");
    console.log("");
    renderBlockedProposals(result.blocked);
    console.log("");
    return;
  }

  if (!result.selected) {
    console.log("Heartbeat completed.");
    console.log(`Action: ${result.action}`);
    console.log("");
    return;
  }

  const proposal = result.selected.proposal;
  const policy = result.selected.policyDecision;

  console.log(`🫀 Heartbeat: ${proposal.sourceCellId}`);
  console.log("");
  console.log("Proposal");
  console.log(`Action     : ${String(proposal.action).toUpperCase()}`);
  renderProposalRepairFields(proposal);

  if (proposal.suggestedChildId) {
    console.log(`Child      : ${proposal.suggestedChildId}`);
  }

  if (proposal.targetCellIds?.length > 0) {
    console.log(`Targets    : ${proposal.targetCellIds.join(", ")}`);
  }

  console.log(`Confidence : ${Math.round((proposal.confidence ?? 0) * 100)}%`);
  console.log(`Reason     : ${proposal.reason}`);
  console.log("");
  console.log("Policy");
  console.log(`Allowed    : ${policy.allowed ? "YES" : "NO"}`);
  console.log(`Risk       : ${String(policy.riskLevel || "unknown").toUpperCase()}`);
  console.log(`Warnings   : ${policy.warnings?.length ? policy.warnings.join("; ") : "None"}`);

  if (policy.reasons?.length > 0) {
    console.log(`Reasons    : ${policy.reasons.join("; ")}`);
  }

  console.log("");

  if (proposal.status === "blocked") {
    console.log("Proposal blocked.");
    console.log("No approval requested.");
    console.log("No colony state was changed.");
  } else if (proposal.status === "rejected") {
    console.log("Proposal rejected.");
    console.log("No colony state was changed.");
  } else if (proposal.status === "completed") {
    if (result.mode === HeartbeatMode.AUTOMATIC && result.selected.userDecision?.automatic) {
      console.log("Automatic mode enabled.");
    }
    console.log(`Lifecycle action completed: ${proposal.action}`);
  } else if (proposal.status === "failed") {
    console.log("Lifecycle execution failed.");
    console.log("");
    console.log(`Action : ${String(proposal.action).toUpperCase()}`);
    console.log(`Cell   : ${proposal.sourceCellId}`);
    console.log(`Stage  : ${result.selected.executionResult?.errorStage ?? "-"}`);
    console.log(`Reason : ${result.selected.executionResult?.errorMessage ?? "-"}`);
  }

  console.log("");
}

function createCliApprovalService({ engine }) {
  return {
    async requestApproval({ proposal, policyDecision, mode }) {
      if (!policyDecision.allowed) {
        return false;
      }

      if (!engine?.rl) {
        throw new Error("CLI approval requires engine readline");
      }

      console.log("");
      console.log(`🫀 Heartbeat: ${proposal.sourceCellId}`);
      console.log("");
      console.log("Proposal");
      console.log(`Action     : ${String(proposal.action).toUpperCase()}`);
      renderProposalRepairFields(proposal);
      if (proposal.suggestedChildId) {
        console.log(`Child      : ${proposal.suggestedChildId}`);
      }
      console.log(`Confidence : ${Math.round((proposal.confidence ?? 0) * 100)}%`);
      console.log(`Reason     : ${proposal.reason}`);
      console.log("");
      console.log("Policy");
      console.log(`Allowed    : YES`);
      console.log(`Risk       : ${String(policyDecision.riskLevel).toUpperCase()}`);
      console.log(`Warnings   : ${policyDecision.warnings?.length ? policyDecision.warnings.join("; ") : "None"}`);
      console.log("");

      if (mode === HeartbeatMode.AUTOMATIC) {
        console.log("Automatic mode requires approval because policy requested it.");
      }

      while (true) {
        const answer =
          (await askEngineQuestion(
            engine,
            `Execute ${proposal.action}? (Yes/No): `
          ))
            .trim()
            .toLowerCase();

        if (answer === "y" || answer === "yes") {
          console.log("Proposal approved.");
          console.log(`Starting ${proposal.action}...`);
          return true;
        }

        if (answer === "n" || answer === "no") {
          console.log("Proposal rejected.");
          console.log("No colony state was changed.");
          return false;
        }

        console.log("Please answer Yes or No.");
      }
    }
  };
}

function askEngineQuestion(engine, question) {
  return new Promise((resolve) => {
    engine.rl.question(question, resolve);
  });
}

function renderProposalRepairFields(proposal) {
  if (proposal.action !== "repair") {
    return;
  }

  const repairType = proposal.repairType ?? "unknown";
  console.log(`Repair Type : ${String(repairType).toUpperCase()}`);

  if (repairType === "artifact") {
    console.log("Strategy    : STABILIZE");
  } else {
    console.log("Strategy    : Not implemented");
  }

  console.log(`Artifact    : ${proposal.artifactId ?? "-"}`);
  console.log(`Threat      : ${proposal.threatId ?? "-"}`);
}

function renderBlockedProposals(blocked = []) {
  console.log("Blocked:");

  for (const record of blocked) {
    const proposal = record.proposal ?? {};
    const policy = record.policyDecision ?? {};
    const action = String(proposal.action ?? "-").toUpperCase();
    const repairType =
      proposal.action === "repair"
        ? ` / ${String(proposal.repairType ?? "unknown").toUpperCase()}`
        : "";

    console.log(`- ${proposal.sourceCellId ?? "-"} ${action}${repairType}`);

    if (policy.reasons?.length > 0) {
      console.log(`  ${policy.reasons.join("; ")}`);
    }
  }
}
