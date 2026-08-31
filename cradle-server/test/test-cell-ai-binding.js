import assert from "node:assert/strict";
import { normalizeCellAiBinding } from "../src/ai/cell-ai-binding.js";
import { CradleCell } from "../src/cradle-cell.js";

assert.deepEqual(normalizeCellAiBinding({ provider: "codex" }), {
  schemaVersion: 1,
  provider: "codex",
  model: "auto",
  mode: "pinned",
});
assert.throws(
  () => normalizeCellAiBinding({ provider: "unknown", model: "x" }),
  /Invalid AI provider/
);
assert.throws(
  () => normalizeCellAiBinding(
    { provider: "codex", model: "not-supported" },
    { strictModel: true }
  ),
  /Invalid AI model/
);

let factoryCalls = 0;
const factoryBindings = [];
const assistant = {
  ask: async () => ({ text: "ok" }),
  cleanup: async () => {},
};
const cell = new CradleCell({
  id: "lazy-cell",
  assistantFactory: async ({ binding }) => {
    factoryCalls += 1;
    factoryBindings.push(binding);
    return assistant;
  },
});

assert.equal(cell.provider, "codex");
assert.equal(cell.model, "auto");
assert.equal(cell.assistant, null);
assert.equal(factoryCalls, 0);

const [first, second] = await Promise.all([
  cell.ensureAssistant(),
  cell.ensureAssistant(),
]);
assert.equal(first, assistant);
assert.equal(second, assistant);
assert.equal(factoryCalls, 1);
assert.equal(factoryBindings[0].provider, "codex");
assert.equal(factoryBindings[0].model, "auto");

cell.getProfile = async () => ({ id: cell.id, status: "running" });
cell.writeCellProfile = async (profile) => {
  cell.persistedProfile = profile;
};
cell.isTicking = true;
const deferred = await cell.setAiBinding({
  provider: "ollama",
  model: "gemma3:latest",
  mode: "default",
  deferIfBusy: true,
});
assert.equal(deferred.pending, true);
assert.equal(cell.provider, "codex");
cell.isTicking = false;
assert.equal(await cell.applyPendingAiBinding(), true);
assert.equal(cell.provider, "ollama");
assert.equal(cell.model, "gemma3:latest");
assert.equal(factoryCalls, 2);
assert.equal(factoryBindings[1].provider, "ollama");
assert.equal(cell.persistedProfile.ai.mode, "default");

console.log("Cell AI binding tests passed");
