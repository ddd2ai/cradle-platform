import assert from "node:assert/strict";
import {
  RuntimeActivityLogger,
  formatRuntimeActivity,
} from "../src/application/runtime-activity-logger.js";

const entries = [];
const logger = new RuntimeActivityLogger({ write: (entry) => entries.push(entry) });
logger.info("cultivation", "cell.selected", {
  operationId: "op-1",
  cellId: "orders",
  decision: "cultivate",
});

assert.deepEqual(entries[0], {
  level: "info",
  scope: "cultivation",
  action: "cell.selected",
  fields: {
    operationId: "op-1",
    cellId: "orders",
    decision: "cultivate",
  },
});
assert.equal(
  formatRuntimeActivity(entries[0]),
  "[cultivation] cell.selected operationId=op-1 cellId=orders decision=cultivate",
);

logger.warn("stimulus", "unsafe\nname", { reason: "line one\nline two" });
assert.equal(entries[1].action, "unsafe_name");
assert.equal(entries[1].fields.reason, "line one line two");

const failingLogger = new RuntimeActivityLogger({ write: () => { throw new Error("sink failed"); } });
assert.doesNotThrow(() => failingLogger.error("runtime", "failed", { error: "x" }));

console.log("Runtime activity logger tests passed");
