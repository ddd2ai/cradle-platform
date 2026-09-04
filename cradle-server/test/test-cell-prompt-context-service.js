import assert from "node:assert/strict";
import { CellPromptContextService } from "../src/cell/cell-prompt-context-service.js";

const calls = [];
const cell = {
  visionFile: "VISION.md",
  environmentFile: "ENVIRONMENT.md",
  dnaDefinitionFile: "DNA_DEFINITION.md",
  dnaFactorsFile: "DNA_FACTORS.md",
  async safeReadFile(file) { calls.push(file); return file; },
  async safeReadMemory(name) { calls.push(name); return `${name}-content`; },
  async getDNAFiles() { return {}; },
  async readDNAVector() { return null; },
  async readVision() { return "vision"; },
  async readEnvironment() { return "environment"; },
  async readLivingContext() { return { purpose: "Payments" }; },
  async readRecentHistory(limit) { return `history-${limit}`; },
  async readRecentThoughts(limit) { return `thoughts-${limit}`; },
};

const service = new CellPromptContextService({ cell });
const operational = await service.buildOperationalContext("inspect failure");
assert.match(operational, /"purpose": "Payments"/);
assert.match(operational, /history-8000/);
assert.match(operational, /thoughts-4000/);
assert.match(operational, /inspect failure/);
assert.doesNotMatch(operational, /knowledge-content/);

const system = await service.buildCellSystemPrompt();
assert.match(system, /# LIVING CONTEXT/);
assert.match(system, /"purpose": "Payments"/);
assert.match(system, /knowledge-content/);

console.log("Cell prompt context service tests passed");
