import { HeartbeatMode } from "../heartbeat/heartbeat-mode.js";

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

export function renderProposalRepairFields(proposal) {
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
