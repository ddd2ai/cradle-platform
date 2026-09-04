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

        const result = await this.heartbeatServiceFactory({
          engine: this.engine,
        }).beat({ onProgress: update });
        update({ progress: 100, currentStage: "heartbeat-complete" });
        return result;
      },
    });

    return {
      operationId: operation.operationId,
      type: operation.type,
      status: operation.status,
    };
  }
}
