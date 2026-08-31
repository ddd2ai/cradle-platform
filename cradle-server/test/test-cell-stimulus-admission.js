import assert from "node:assert/strict";
import { CradleCell } from "../src/cradle-cell.js";

const notifications = [];
const cell = new CradleCell({
  id: "cell-admission",
  activationNotifier: (cellIds, reason, context) => {
    notifications.push({ cellIds, reason, context });
  },
});

cell.stimulusStore = {
  async writeStimulus(input) {
    return {
      envelope: {
        schemaVersion: 1,
        stimulusId: input.dedupKey,
        type: input.type,
        source: input.source,
        facts: input.facts,
      },
      routes: [{ targetCellId: cell.id }],
    };
  },
};

await cell.writeStimulus({
  type: "artifact.execution.passed",
  source: "internal.execution",
  dedupKey: "passive",
  facts: { status: "passed" },
});
assert.equal(notifications[0].context.admission.activate, false);
assert.equal(notifications[0].context.admission.decision, "summary-only");

await cell.writeStimulus({
  type: "artifact.execution.runtime_failed",
  source: "internal.execution",
  dedupKey: "actionable",
  facts: { status: "runtime_failed" },
});
assert.equal(notifications[1].context.admission.activate, true);

cell.stimulusStore.writeStimulus = async () => ({
  duplicate: true,
  envelope: {
    schemaVersion: 1,
    stimulusId: "duplicate",
    type: "artifact.execution.runtime_failed",
    source: "internal.execution",
    facts: { status: "runtime_failed" },
  },
});
await cell.writeStimulus({ dedupKey: "duplicate" });
assert.equal(notifications.length, 2, "duplicate stimulus must not wake a Cell");

console.log("Cell stimulus admission tests passed");
