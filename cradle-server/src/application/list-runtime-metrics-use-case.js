export class ListRuntimeMetricsUseCase {
  constructor({ metrics } = {}) {
    this.metrics = metrics;
  }

  async execute() {
    return { metrics: this.metrics?.snapshot?.() ?? null };
  }
}
