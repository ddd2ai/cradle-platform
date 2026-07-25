import path from "path";
import { readCradleConfig } from "../cradle-config.js";
import { writeJsonFile } from "../utils/json-file.js";
import { PROJECT_ROOT } from "../project-root.js";

export const HeartbeatMode = Object.freeze({
  MANUAL: "manual",
  AUTOMATIC: "automatic",
});

export class HeartbeatModeStore {
  constructor({ file = path.join(PROJECT_ROOT, "config", "cradle-config.json") } = {}) {
    this.file = file;
  }

  async getMode() {
    const { mode } = await this.getState();

    return mode;
  }

  async getState() {
    const config = await this._readConfig();
    const mode =
      config.heartbeat?.mode ||
      HeartbeatMode.MANUAL;

    if (!Object.values(HeartbeatMode).includes(mode)) {
      return {
        mode: HeartbeatMode.MANUAL,
        startedAt: null,
      };
    }

    return {
      mode,
      startedAt: config.heartbeat?.cultivationStartedAt ?? null,
    };
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

    if (mode === HeartbeatMode.AUTOMATIC && previous !== HeartbeatMode.AUTOMATIC) {
      config.heartbeat.cultivationStartedAt = new Date().toISOString();
    }

    if (mode === HeartbeatMode.MANUAL) {
      delete config.heartbeat.cultivationStartedAt;
    }

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
