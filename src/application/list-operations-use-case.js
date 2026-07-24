export class ListOperationsUseCase {
  constructor({ operationStore }) {
    this.operationStore = operationStore;
  }

  async execute() {
    return {
      operations: this.operationStore.list(),
    };
  }
}
