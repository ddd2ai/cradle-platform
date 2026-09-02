import assert from "node:assert/strict";
import {
  rankStimulusRelevance,
  selectStimulusTargets,
} from "../src/situation/stimulus-relevance-policy.js";

const cells = [
  { cellId: "orders", purpose: "Order lifecycle", responsibilities: ["payment validation"] },
  { cellId: "catalog", purpose: "Product catalog", responsibilities: ["inventory indexing"] },
];
const ranked = rankStimulusRelevance({
  stimulus: { content: "Payment validation for an order failed" },
  cells,
});
assert.equal(ranked[0].cellId, "orders");
assert.ok(ranked[0].relevance > ranked[1].relevance);

assert.deepEqual(
  selectStimulusTargets({ stimulus: {}, cells, explicitCellId: "catalog" }).targets,
  [{ cellId: "catalog", relevance: 1, reason: "explicit user target" }],
);
assert.equal(
  selectStimulusTargets({ stimulus: { content: "unrelated" }, cells }).needsAttention,
  true,
);
assert.equal(
  selectStimulusTargets({ stimulus: { content: "anything" }, cells: [cells[0]] }).targets[0].cellId,
  "orders",
);

console.log("Stimulus relevance policy tests passed");
