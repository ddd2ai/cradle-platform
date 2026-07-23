import path from "path";
import {
  getHeartbeatMode,
  readCradleConfig,
} from "../cradle-config.js";
import { writeJsonFile } from "../utils/json-file.js";

export const HeartbeatMode = Object.freeze({
  MANUAL: "manual",
  AUTOMATIC: "automatic",
});

export class HeartbeatModeStore {
  constructor({ file = path.join("config", "cradle-config.json") } = {}) {
    this.file = file;
  }

  async getMode() {
    const mode =
      getHeartbeatMode({ file: this.file }) ||
      HeartbeatMode.MANUAL;

    if (!Object.values(HeartbeatMode).includes(mode)) {
      return HeartbeatMode.MANUAL;
    }

    return mode;
  }

  async setMode(mode) {
    if (!Object.values(HeartbeatMode).includes(mode)) {
      throw new Error(`Invalid heartbeat mode: ${mode}`);
    }

    const config = await this._readConfig();
    const previous = config.heartbeat?.mode || HeartbeatMode.MANUAL;

    config.heartbeat = {
      ...(config.heartbeat || {}),
      mode,
    };

    await writeJsonFile(this.file, config, { dir: path.dirname(this.file) });

    return {
      previous,
      current: mode,
    };
  }

  async _readConfig() {
    return readCradleConfig({
      file: this.file,
    });
  }
}
