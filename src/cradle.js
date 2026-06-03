import { CradleEngine } from "./cradle-engine.js";

const MODEL = process.env.MODEL || "gpt-4.1";

const engine = new CradleEngine({
  model: MODEL,
});

await engine.start();