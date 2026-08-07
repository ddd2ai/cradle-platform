export class StartOperationUseCase {
  constructor({ operationRunner }) {
    this.operationRunner = operationRunner;
  }

  execute({ type, context = {}, task }) {
    const operation = this.operationRunner.start({ type, context, task });

    return {
      operationId: operation.operationId,
      type: operation.type,
      status: operation.status,
      progress: operation.progress,
      currentStage: operation.currentStage,
      context: operation.context,
    };
  }
}
