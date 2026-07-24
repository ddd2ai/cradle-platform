import { HeartbeatService } from "../heartbeat/heartbeat-service.js";

export class RunHeartbeatUseCase {
  constructor({
    engine,
    operationRunner,
    heartbeatServiceFactory = ({ engine }) => new HeartbeatService({ engine }),
  }) {
    this.engine = engine;
    this.operationRunner = operationRunner;
    this.heartbeatServiceFactory = heartbeatServiceFactory;
  }

  async execute() {
    const operation = this.operationRunner.start({
      type: "heartbeat",
      task: async ({ update }) => {
        update({
          progress: 20,
          currentStage: "heartbeat",
        });

        return await this.heartbeatServiceFactory({
          engine: this.engine,
        }).beat();
      },
    });

    return {
      operationId: operation.operationId,
      type: operation.type,
      status: operation.status,
    };
  }
}
