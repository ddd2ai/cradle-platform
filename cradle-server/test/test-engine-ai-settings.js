import assert from "node:assert/strict";
import { CradleEngine } from "../src/cradle-engine.js";

const engine = new CradleEngine();
const calls = [];
engine.cells.set("default-cell", {
  getAiBinding: () => ({ mode: "default" }),
  setAiBinding: async (binding) => calls.push({ cellId: "default-cell", binding }),
});
engine.cells.set("pinned-cell", {
  getAiBinding: () => ({ mode: "pinned" }),
  setAiBinding: async (binding) => calls.push({ cellId: "pinned-cell", binding }),
});

await engine.setAiSettings({ provider: "ollama", model: "gemma3:latest" });
assert.equal(engine.provider, "ollama");
assert.equal(engine.model, "gemma3:latest");
assert.equal(calls.length, 1);
assert.equal(calls[0].cellId, "default-cell");
assert.deepEqual(calls[0].binding, {
  provider: "ollama",
  model: "gemma3:latest",
  mode: "default",
  deferIfBusy: true,
});

console.log("Engine AI settings tests passed");
