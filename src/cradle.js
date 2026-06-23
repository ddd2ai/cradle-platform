import { CradleEngine } from "./cradle-engine.js";

const PROVIDER = process.env.PROVIDER || "ollama";
const MODEL = process.env.MODEL || (PROVIDER === "ollama" ? "llama3.1:8b" : "gpt-5-mini"); 

const engine = new CradleEngine({
  provider: PROVIDER,
  model: MODEL,
});

await engine.start();