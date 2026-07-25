export class ClearLogsUseCase {
  constructor({ logBuffer }) {
    this.logBuffer = logBuffer;
  }

  async execute() {
    this.logBuffer?.clear?.();

    return {
      logs: [],
    };
  }
}
