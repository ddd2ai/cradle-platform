import fs from "fs/promises";
import path from "path";

export const HeartbeatMode = Object.freeze({
  MANUAL: "manual",
  AUTOMATIC: "automatic",
});

export class HeartbeatModeStore {
  constructor({ file = path.join("config", "runtime.json") } = {}) {
    this.file = file;
  }

  async getMode() {
    const config = await this._readConfig();
    const mode = config.heartbeat?.mode || HeartbeatMode.MANUAL;

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

    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(config, null, 2), "utf8");

    return {
      previous,
      current: mode,
    };
  }

  async _readConfig() {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }
}
