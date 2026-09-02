export class GetFoundationUseCase {
  constructor({ foundationDocumentStore }) {
    this.foundationDocumentStore = foundationDocumentStore;
  }

  async execute() {
    return {
      documents: await this.foundationDocumentStore.list(),
    };
  }
}
