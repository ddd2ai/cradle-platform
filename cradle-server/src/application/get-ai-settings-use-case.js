export class GetAiSettingsUseCase {
  constructor({ engine, settingsStore }) {
    this.engine = engine;
    this.settingsStore = settingsStore;
  }

  async execute() {
    const settings = await this.settingsStore.getSettings();

    return {
      ...settings,
      current: {
        provider: this.engine?.provider ?? settings.provider,
        model: this.engine?.model ?? settings.model,
      },
    };
  }
}
