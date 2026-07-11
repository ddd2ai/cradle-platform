import { CradleEngine } from "./cradle-engine.js";

const PROVIDER = process.env.PROVIDER ?? "ollama";

const DEFAULT_MODELS = {
  ollama: "devstral:24b",
  copilot: "gpt-5-mini",
  gemini: "auto",
  codex: "auto",
};

const MODEL =
  process.env.MODEL ??
  DEFAULT_MODELS[PROVIDER];

if (!MODEL) {
  throw new Error(
    `No default model configured for provider: ${PROVIDER}`
  );
}

const engine = new CradleEngine({
  provider: PROVIDER,
  model: MODEL,
});

await engine.start();