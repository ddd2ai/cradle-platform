import { MerlinEngine } from "./merlin-engine.js";

const MODEL = process.env.MODEL || "gpt-4.1";

const engine = new MerlinEngine({
  model: MODEL,
});

await engine.start();