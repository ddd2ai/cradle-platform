export class ListLogsUseCase {
  constructor({ logBuffer }) {
    this.logBuffer = logBuffer;
  }

  async execute() {
    return {
      logs: this.logBuffer?.list?.() ?? [],
    };
  }
}
