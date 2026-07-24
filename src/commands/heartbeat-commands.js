import { HeartbeatService } from "../heartbeat/heartbeat-service.js";
import { HeartbeatMode, HeartbeatModeStore } from "../heartbeat/heartbeat-mode.js";
import { LifecycleProposalStore } from "../heartbeat/lifecycle-proposal-store.js";
import { createCliApprovalService } from "./cli-approval-service.js";
import { commandArgs } from "./command-input.js";
import { renderHeartbeatResult } from "./heartbeat-result-renderer.js";

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
