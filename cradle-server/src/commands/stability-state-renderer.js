export function renderStabilityState(state) {
  console.log(`
Status               : ${state.status}
Consecutive Passed   : ${state.consecutivePassed}
Consecutive No Task  : ${state.consecutiveNoTask}
Repair Count         : ${state.repairCount}
Updated At           : ${state.updatedAt}
${state.stableAt ? `Stable At            : ${state.stableAt}` : ""}

Recent Records (last 5):
${state.records.slice(-5).map((record) => `
- Round ${record.round}
  Status     : ${record.executionStatus}
  Tasks      : ${record.createdTasks}
  Observation: ${record.observationFile ?? "-"}
  Created At : ${record.createdAt}
`).join("\n")}
`);
}
