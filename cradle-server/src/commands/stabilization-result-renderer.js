export function renderStabilizationResult(result) {
  console.log(`
Stabilization completed.

Artifact : ${result.artifactId}
Stable   : ${result.stable ? "yes" : "no"}
Rounds   : ${result.rounds ?? result.history.length}
Reason   : ${result.reason ?? "-"}

History:
${result.history.map((item) => `
- Round ${item.round}
  executionStatus: ${item.executionStatus}
  createdTasks   : ${item.createdTasks}
  observation    : ${item.observationFile ?? "-"}
  tasks          : ${
    item.newTasks.length === 0
      ? "-"
      : item.newTasks.map((task) => task.title).join(", ")
  }
`).join("\n")}
`);
}
