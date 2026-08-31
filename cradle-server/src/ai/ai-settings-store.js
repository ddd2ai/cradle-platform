import path from "path";
import { readCradleConfig } from "../cradle-config.js";
import { PROJECT_ROOT } from "../project-root.js";
import { writeJsonFile } from "../utils/json-file.js";
import {
  AI_PROVIDER_OPTIONS,
  normalizeCellAiBinding,
} from "./cell-ai-binding.js";

export { AI_PROVIDER_OPTIONS } from "./cell-ai-binding.js";

export class AiSettingsStore {
  constructor({ file = path.join(PROJECT_ROOT, "config", "cradle-config.json") } = {}) {
    this.file = file;
  }

  async getSettings() {
    const config = await this._readConfig();
    const binding = normalizeCellAiBinding({
      provider: config.ai?.defaultProvider || "codex",
      model: config.ai?.defaultModel,
      mode: "default",
    });

    return {
      provider: binding.provider,
      model: binding.model,
      options: AI_PROVIDER_OPTIONS,
    };
  }

  async setSettings({ provider, model } = {}) {
    const current = await this.getSettings();
    const next = normalizeCellAiBinding({
      provider: provider ?? current.provider,
      model: model ?? current.model,
      mode: "default",
    }, { strictModel: true });
    const config = await this._readConfig();

    config.ai = {
      ...(config.ai || {}),
      defaultProvider: next.provider,
      defaultModel: next.model,
    };

    await writeJsonFile(this.file, config, { dir: path.dirname(this.file) });

    return {
      previous: {
        provider: current.provider,
        model: current.model,
      },
      current: {
        provider: next.provider,
        model: next.model,
      },
      options: AI_PROVIDER_OPTIONS,
    };
  }

  async _readConfig() {
    return readCradleConfig({ file: this.file });
  }
}
