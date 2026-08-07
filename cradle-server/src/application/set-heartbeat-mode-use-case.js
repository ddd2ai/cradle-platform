import { HeartbeatMode } from "../heartbeat/heartbeat-mode.js";
import { ApiError } from "../api/api-error.js";

export class SetHeartbeatModeUseCase {
  constructor({ heartbeatModeStoreFactory, eventStream = null }) {
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
    this.eventStream = eventStream;
  }

  async execute({ mode }) {
    if (!Object.values(HeartbeatMode).includes(mode)) {
      throw new ApiError({
        status: 400,
        code: "INVALID_HEARTBEAT_MODE",
        message: "Heartbeat mode must be manual or automatic",
        details: { mode },
      });
    }

    const result = await this.heartbeatModeStoreFactory().setMode(mode);
    this.eventStream?.publish("cultivation.updated", {
      mode: result.current,
    });

    return {
      previous: result.previous,
      current: result.current,
    };
  }
}
