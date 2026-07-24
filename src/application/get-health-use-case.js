export class GetHealthUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute() {
    return {
      status: "ok",
      engineInitialized: Boolean(this.engine),
      cellCount: this.engine?.listCellIds?.().length ?? 0,
      activeCellId: this.engine?.activeCellId ?? null,
    };
  }
}
