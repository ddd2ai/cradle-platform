import { HeartbeatService } from "../heartbeat/heartbeat-service.js";
import { HeartbeatMode, HeartbeatModeStore } from "../heartbeat/heartbeat-mode.js";
import { LifecycleProposalStore } from "../heartbeat/lifecycle-proposal-store.js";
import { commandArgs } from "./command-input.js";
import {
  renderHeartbeatResult,
  renderProposalRepairFields,
} from "./heartbeat-result-renderer.js";

export { renderHeartbeatResult } from "./heartbeat-result-renderer.js";

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
