import assert from "node:assert/strict";
import { GetCellAiBindingUseCase } from "../src/application/get-cell-ai-binding-use-case.js";
import { SetCellAiBindingUseCase } from "../src/application/set-cell-ai-binding-use-case.js";

const events = [];
const cell = {
  id: "cell-001",
  provider: "codex",
  model: "auto",
  assistant: null,
  binding: {
    schemaVersion: 1,
    provider: "codex",
    model: "auto",
    mode: "default",
  },
  getAiBinding() {
    return { ...this.binding };
  },
  async setAiBinding(binding) {
    this.binding = { schemaVersion: 1, ...binding };
    this.provider = binding.provider;
    this.model = binding.model;
    return this.getAiBinding();
  },
};
const engine = {
  getCell: (cellId) => cellId === cell.id ? cell : null,
};

const current = await new GetCellAiBindingUseCase({ engine }).execute({
  cellId: cell.id,
});
assert.equal(current.binding.provider, "codex");
assert.equal(current.assistantLoaded, false);

const updated = await new SetCellAiBindingUseCase({
  engine,
  eventStream: { publish: (type, payload) => events.push({ type, payload }) },
}).execute({
  cellId: cell.id,
  provider: "ollama",
  model: "gemma3:latest",
  mode: "pinned",
});
assert.equal(updated.binding.provider, "ollama");
assert.equal(updated.binding.mode, "pinned");
assert.equal(events[0].type, "cell.ai.updated");

await assert.rejects(
  () => new GetCellAiBindingUseCase({ engine }).execute({ cellId: "missing" }),
  (error) => error.status === 404 && error.code === "CELL_NOT_FOUND"
);

console.log("Cell AI binding use case tests passed");
