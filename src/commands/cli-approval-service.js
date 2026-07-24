import { HeartbeatMode } from "../heartbeat/heartbeat-mode.js";
import { renderProposalRepairFields } from "./heartbeat-result-renderer.js";

export function createCliApprovalService({ engine }) {
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
    },
  };
}

function askEngineQuestion(engine, question) {
  return new Promise((resolve) => {
    engine.rl.question(question, resolve);
  });
}
