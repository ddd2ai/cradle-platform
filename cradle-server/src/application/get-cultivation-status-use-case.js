export class GetCultivationStatusUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute() {
    return this.engine.getCultivationStatus();
  }
}
