export const AI_PROVIDER_OPTIONS = Object.freeze([
  {
    id: "copilot",
    label: "Copilot",
    models: ["gpt-5.5", "gpt-5.6", "gpt-5-mini"],
  },
  {
    id: "ollama",
    label: "Ollama",
    models: ["devstral-small-2:24b", "gemma3:latest"],
  },
  {
    id: "gemini",
    label: "Gemini",
    models: ["auto", "gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "codex",
    label: "Codex",
    models: ["auto", "gpt-5.6"],
  },
]);

export const DEFAULT_AI_MODELS = Object.freeze({
  copilot: "gpt-5-mini",
  ollama: "devstral-small-2:24b",
  gemini: "auto",
  codex: "auto",
});

export function normalizeCellAiBinding({
  provider,
  model,
  mode = "pinned",
} = {}, { strictModel = false } = {}) {
  const providerId = String(provider ?? "").trim().toLowerCase();
  const option = AI_PROVIDER_OPTIONS.find((item) => item.id === providerId);
  if (!option) {
    throw new Error(`Invalid AI provider: ${provider}`);
  }

  const modelId = String(model ?? DEFAULT_AI_MODELS[providerId] ?? "").trim();
  if (!modelId || (strictModel && !option.models.includes(modelId))) {
    throw new Error(`Invalid AI model for ${providerId}: ${model}`);
  }
  if (!["default", "pinned"].includes(mode)) {
    throw new Error(`Invalid Cell AI binding mode: ${mode}`);
  }

  return {
    schemaVersion: 1,
    provider: providerId,
    model: modelId,
    mode,
  };
}
