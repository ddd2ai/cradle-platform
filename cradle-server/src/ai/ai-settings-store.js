import path from "path";
import { readCradleConfig } from "../cradle-config.js";
import { PROJECT_ROOT } from "../project-root.js";
import { writeJsonFile } from "../utils/json-file.js";

export const AI_PROVIDER_OPTIONS = Object.freeze([
  {
    id: "copilot",
    label: "OpenAI",
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

const DEFAULT_MODELS = Object.freeze({
  copilot: "gpt-5-mini",
  ollama: "devstral-small-2:24b",
  gemini: "auto",
  codex: "auto",
});

export class AiSettingsStore {
  constructor({ file = path.join(PROJECT_ROOT, "config", "cradle-config.json") } = {}) {
    this.file = file;
  }

  async getSettings() {
    const config = await this._readConfig();
    const provider = normalizeProvider(config.ai?.defaultProvider || "ollama");
    const model = config.ai?.defaultModel || DEFAULT_MODELS[provider];

    return {
      provider,
      model,
      options: AI_PROVIDER_OPTIONS,
    };
  }

  async setSettings({ provider, model } = {}) {
    const current = await this.getSettings();
    const nextProvider = normalizeProvider(provider ?? current.provider);
    const nextModel = normalizeModel(nextProvider, model ?? current.model);
    const config = await this._readConfig();

    config.ai = {
      ...(config.ai || {}),
      defaultProvider: nextProvider,
      defaultModel: nextModel,
    };

    await writeJsonFile(this.file, config, { dir: path.dirname(this.file) });

    return {
      previous: {
        provider: current.provider,
        model: current.model,
      },
      current: {
        provider: nextProvider,
        model: nextModel,
      },
      options: AI_PROVIDER_OPTIONS,
    };
  }

  async _readConfig() {
    return readCradleConfig({ file: this.file });
  }
}

function normalizeProvider(provider) {
  const providerId = String(provider ?? "").trim().toLowerCase();

  if (!AI_PROVIDER_OPTIONS.some((option) => option.id === providerId)) {
    throw new Error(`Invalid AI provider: ${provider}`);
  }

  return providerId;
}

function normalizeModel(provider, model) {
  const value = String(model ?? "").trim();
  const option = AI_PROVIDER_OPTIONS.find((item) => item.id === provider);

  if (!value || !option?.models.includes(value)) {
    throw new Error(`Invalid AI model for ${provider}: ${model}`);
  }

  return value;
}
