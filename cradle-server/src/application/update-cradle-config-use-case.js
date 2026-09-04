import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../api/api-error.js";
import { PROJECT_ROOT } from "../project-root.js";

const DEFAULT_CRADLE_CONFIG_FILE = path.join(
  PROJECT_ROOT,
  "config",
  "cradle-config.json"
);

const ALLOWED_PROVIDERS = new Set(["ollama", "copilot", "codex", "gemini"]);
const ALLOWED_HEARTBEAT_MODES = new Set(["manual", "auto"]);

export class UpdateCradleConfigUseCase {
  constructor({ file = DEFAULT_CRADLE_CONFIG_FILE } = {}) {
    this.file = file;
  }

  async execute({ config }) {
    const validatedConfig = validateCradleConfig(config);
    const fileDir = path.dirname(this.file);
    const tempFile = path.join(
      fileDir,
      `.cradle-config.${process.pid}.${Date.now()}.tmp`
    );

    try {
      await fs.writeFile(
        tempFile,
        `${JSON.stringify(validatedConfig, null, 2)}\n`,
        "utf8"
      );
      await fs.rename(tempFile, this.file);
    } catch (error) {
      await fs.rm(tempFile, { force: true }).catch(() => {});
      throw error;
    }

    return JSON.parse(await fs.readFile(this.file, "utf8"));
  }
}

function validateCradleConfig(config) {
  if (!isPlainObject(config)) {
    throw invalidConfig("Configuration must be an object.");
  }

  const ai = requireObject(config.ai, "ai");
  const providers = requireObject(config.providers, "providers");
  const timeouts = requireObject(config.timeouts, "timeouts");
  const heartbeat = requireObject(config.heartbeat, "heartbeat");
  const defaultProvider = requireAllowedProvider(
    ai.defaultProvider,
    "ai.defaultProvider"
  );
  const defaultModel = requireNonEmptyString(ai.defaultModel, "ai.defaultModel");
  const aiTimeoutSeconds = requirePositiveInteger(
    ai.timeoutSeconds,
    "ai.timeoutSeconds"
  );
  const maxSourceArtifactOutputLength = requirePositiveInteger(
    ai.maxSourceArtifactOutputLength,
    "ai.maxSourceArtifactOutputLength"
  );
  const maxSourceArtifactContentLength = requirePositiveInteger(
    ai.maxSourceArtifactContentLength,
    "ai.maxSourceArtifactContentLength"
  );

  if (maxSourceArtifactContentLength > maxSourceArtifactOutputLength) {
    throw invalidConfig(
      "ai.maxSourceArtifactContentLength must not exceed ai.maxSourceArtifactOutputLength.",
      { path: "ai.maxSourceArtifactContentLength" }
    );
  }

  const validatedProviders = {};
  for (const provider of ALLOWED_PROVIDERS) {
    const providerConfig = requireObject(
      providers[provider],
      `providers.${provider}`
    );
    validatedProviders[provider] = {
      timeoutSeconds: requirePositiveInteger(
        providerConfig.timeoutSeconds,
        `providers.${provider}.timeoutSeconds`
      ),
    };
  }

  return {
    ai: {
      defaultProvider,
      defaultModel,
      timeoutSeconds: aiTimeoutSeconds,
      maxSourceArtifactOutputLength,
      maxSourceArtifactContentLength,
    },
    providers: validatedProviders,
    timeouts: {
      cultivationSeconds: requirePositiveInteger(
        timeouts.cultivationSeconds,
        "timeouts.cultivationSeconds"
      ),
      reflectionSeconds: requirePositiveInteger(
        timeouts.reflectionSeconds,
        "timeouts.reflectionSeconds"
      ),
      mavenExecutionSeconds: requirePositiveInteger(
        timeouts.mavenExecutionSeconds,
        "timeouts.mavenExecutionSeconds"
      ),
    },
    heartbeat: {
      mode: requireHeartbeatMode(heartbeat.mode, "heartbeat.mode"),
    },
  };
}

function requireObject(value, pathName) {
  if (!isPlainObject(value)) {
    throw invalidConfig(`${pathName} must be an object.`, { path: pathName });
  }

  return value;
}

function requireAllowedProvider(value, pathName) {
  if (typeof value !== "string" || !ALLOWED_PROVIDERS.has(value)) {
    throw invalidConfig(
      `${pathName} must be one of: ollama, copilot, codex, gemini.`,
      { path: pathName }
    );
  }

  return value;
}

function requireNonEmptyString(value, pathName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidConfig(`${pathName} must not be empty.`, { path: pathName });
  }

  return value.trim();
}

function requirePositiveInteger(value, pathName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidConfig(`${pathName} must be a positive integer.`, {
      path: pathName,
    });
  }

  return value;
}

function requireHeartbeatMode(value, pathName) {
  if (typeof value !== "string" || !ALLOWED_HEARTBEAT_MODES.has(value)) {
    throw invalidConfig(`${pathName} must be manual or auto.`, {
      path: pathName,
    });
  }

  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidConfig(message, details = {}) {
  return new ApiError({
    status: 400,
    code: "INVALID_CRADLE_CONFIG",
    message,
    details,
  });
}
