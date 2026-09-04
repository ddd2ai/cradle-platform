import assert from "node:assert/strict";
import { test } from "node:test";
import { toCultivationViewModel } from "../src/domain/cultivationViewModel.js";

test("cultivation presentation derives progress and phase from runtime state", () => {
  assert.deepEqual(toCultivationViewModel({
    operationId: "op-1",
    type: "stimulus-cultivation",
    status: "running",
    progress: 76,
    currentStage: "evolving",
    lifeState: "growing",
    context: { sourceName: "policy.pdf", cellIds: ["cell-a"] },
  }), {
    operationId: "op-1",
    status: "Growing",
    tone: "growing",
    progress: 76,
    phaseLabel: "Evolving Artifact",
    cellLabel: "cell-a",
    sourceName: "policy.pdf",
    attentionMessage: null,
  });
});

test("failed cultivation is presented as Needs Attention", () => {
  const view = toCultivationViewModel({
    operationId: "op-2",
    status: "failed",
    progress: 90,
    currentStage: "failed",
  });
  assert.equal(view.status, "Needs Attention");
  assert.equal(view.tone, "attention");
  assert.equal(view.progress, 90);
  assert.equal(
    view.attentionMessage,
    "Cradle needs a decision or additional evidence before it can continue.",
  );
});

test("cultivation attention uses the matching Cell reason and never relabels another Cell", () => {
  const view = toCultivationViewModel({
    operationId: "op-3",
    status: "completed",
    progress: 100,
    currentStage: "needs_attention",
    lifeState: "needs_attention",
    context: { sourceName: "policy.md", cellIds: ["cell-a"] },
  }, {
    id: "cell-a",
    name: "Policy Cell",
    cultivation: {
      attention: { message: "Unable to start Codex CLI: spawn codex ENOENT" },
    },
  });

  assert.equal(view.cellLabel, "Policy Cell");
  assert.equal(
    view.attentionMessage,
    "The Codex provider is unavailable. Check the provider installation and retry.",
  );

  const switched = toCultivationViewModel({
    ...view,
    status: "completed",
    currentStage: "needs_attention",
    lifeState: "needs_attention",
    context: { sourceName: "policy.md", cellIds: ["cell-a"] },
  }, { id: "cell-b", name: "Other Cell" });
  assert.equal(switched.cellLabel, "cell-a");
});

test("cultivation attention accepts the safe reason carried by a terminal operation event", () => {
  const view = toCultivationViewModel({
    operationId: "op-image",
    status: "completed",
    progress: 100,
    currentStage: "needs_attention",
    lifeState: "needs_attention",
    attention: { message: "Image analysis provider is unavailable" },
    context: { sourceName: "logo.png", cellIds: ["cell-a"] },
  });
  assert.equal(view.attentionMessage, "Image analysis provider is unavailable");
});

test("cancelled cultivation is neutral and never claims stable quality", () => {
  const view = toCultivationViewModel({
    operationId: "op-cancelled",
    type: "stimulus-cultivation",
    status: "cancelled",
    currentStage: "cancelled",
    lifeState: "cancelled",
    progress: 76,
    context: { cellIds: ["cell-a"] },
  });

  assert.equal(view.status, "Cancelled");
  assert.equal(view.tone, "cancelled");
  assert.equal(view.phaseLabel, "Cancelled");
  assert.notEqual(view.status, "Stable");
});
