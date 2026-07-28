import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../api/api-error.js";
import { PROJECT_ROOT } from "../project-root.js";

const DEFAULT_CRADLE_CONFIG_FILE = path.join(
  PROJECT_ROOT,
  "config",
  "cradle-config.json"
);

export class GetCradleConfigUseCase {
  constructor({ file = DEFAULT_CRADLE_CONFIG_FILE } = {}) {
    this.file = file;
  }

  async execute() {
    let rawConfig;

    try {
      rawConfig = await fs.readFile(this.file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new ApiError({
          status: 500,
          code: "CRADLE_CONFIG_NOT_FOUND",
          message: "Cradle configuration file was not found.",
        });
      }

      throw error;
    }

    try {
      return JSON.parse(rawConfig);
    } catch (error) {
      throw new ApiError({
        status: 500,
        code: "CRADLE_CONFIG_INVALID_JSON",
        message: "Cradle configuration file contains invalid JSON.",
        details: {
          cause: error.message,
        },
      });
    }
  }
}
