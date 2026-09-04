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

const verbosePaymentRouting = selectStimulusTargets({
  stimulus: {
    content: "Production payment retries are failing and duplicate charges are possible. Verify idempotency and preserve transaction evidence before any repair is attempted.",
  },
  cells: [
    {
      cellId: "payment-boundary",
      purpose: "External provider boundary",
      artifacts: [{
        title: "PaymentGatewayBoundary",
        goal: "Preserve payment transaction status",
        outputPaths: ["src/ProviderTransactionRecord.java"],
      }],
    },
    {
      cellId: "catalog",
      purpose: "Product catalog",
      artifacts: [{ title: "InventoryIndex", goal: "Index products" }],
    },
  ],
});
assert.equal(verbosePaymentRouting.needsAttention, false);
assert.equal(verbosePaymentRouting.targets[0].cellId, "payment-boundary");
assert.match(verbosePaymentRouting.targets[0].reason, /payment/);

const boundedOwnershipRouting = selectStimulusTargets({
  stimulus: {
    content: "Cradle Cell must verify payment retry idempotency and preserve the payment result.",
  },
  cells: [
    {
      cellId: "commerce-parent",
      purpose: "Coordinate order lifecycle and payment results",
      inputs: ["PaymentResult"],
      excludes: ["payment retry execution", "payment idempotency ownership"],
    },
    {
      cellId: "payment-core",
      purpose: "Own payment retry idempotency",
      responsibilities: ["validate payment result"],
    },
  ],
});
assert.deepEqual(
  boundedOwnershipRouting.targets.map((target) => target.cellId),
  ["payment-core"],
);
assert.doesNotMatch(boundedOwnershipRouting.targets[0].reason, /cradle|cell/);

console.log("Stimulus relevance policy tests passed");
