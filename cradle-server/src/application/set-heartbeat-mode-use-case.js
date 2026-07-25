import { HeartbeatMode } from "../heartbeat/heartbeat-mode.js";
import { ApiError } from "../api/api-error.js";

export class SetHeartbeatModeUseCase {
  constructor({ heartbeatModeStoreFactory }) {
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
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

    return {
      previous: result.previous,
      current: result.current,
    };
  }
}
