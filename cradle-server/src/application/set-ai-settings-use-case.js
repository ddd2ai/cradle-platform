import { ApiError } from "../api/api-error.js";

export class SetAiSettingsUseCase {
  constructor({ engine, settingsStore }) {
    this.engine = engine;
    this.settingsStore = settingsStore;
  }

  async execute({ provider, model } = {}) {
    try {
      const settings = await this.settingsStore.setSettings({ provider, model });

      await this.engine?.setAiSettings?.(settings.current);

      return settings;
    } catch (error) {
      throw new ApiError({
        status: 400,
        code: "INVALID_AI_SETTINGS",
        message: error.message,
        details: { provider, model },
      });
    }
  }
}
