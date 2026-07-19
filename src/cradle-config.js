import fs from "fs";
import path from "path";

const DEFAULT_CRADLE_CONFIG = Object.freeze({
  ai: Object.freeze({
    defaultProvider: "ollama",
    defaultModel: "devstral-small-2:24b",
    timeoutSeconds: 3600,
    maxSourceArtifactOutputLength: 8000,
    maxSourceArtifactContentLength: 30000,
  }),
  providers: Object.freeze({
    ollama: Object.freeze({
      timeoutSeconds: 3600,
    }),
    copilot: Object.freeze({
      timeoutSeconds: 3600,
    }),
    codex: Object.freeze({
      timeoutSeconds: 3600,
    }),
    gemini: Object.freeze({
      timeoutSeconds: 3600,
    }),
  }),
  timeouts: Object.freeze({
    reflectionSeconds: 30,
    mavenExecutionSeconds: 3600,
  }),
});

const CRADLE_CONFIG_FILE = path.join(
  process.cwd(),
  "config",
  "cradle-config.json"
);

export function readCradleConfig({
  file = CRADLE_CONFIG_FILE,
} = {}) {
  let parsed = {};

  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return {
    ...DEFAULT_CRADLE_CONFIG,
    ...parsed,
    ai: {
      ...DEFAULT_CRADLE_CONFIG.ai,
      ...(parsed.ai || {}),
    },
    providers: {
      ...DEFAULT_CRADLE_CONFIG.providers,
      ...(parsed.providers || {}),
    },
    timeouts: {
      ...DEFAULT_CRADLE_CONFIG.timeouts,
      ...(parsed.timeouts || {}),
    },
  };
}

export function getTimeoutSeconds(name, options = {}) {
  const config = readCradleConfig(options);
  return validateTimeoutSeconds(
    config.timeouts?.[name],
    `timeouts.${name}`
  );
}

export function getTimeoutMs(name, options = {}) {
  return Math.round(getTimeoutSeconds(name, options) * 1000);
}

export function getAiTimeoutSeconds(options = {}) {
  const config = readCradleConfig(options);
  return validateTimeoutSeconds(
    config.ai?.timeoutSeconds,
    "ai.timeoutSeconds"
  );
}

export function getAiDefaultProvider(options = {}) {
  const config = readCradleConfig(options);
  return config.ai?.defaultProvider || "ollama";
}

export function getAiDefaultModel(options = {}) {
  const config = readCradleConfig(options);
  return config.ai?.defaultModel || null;
}

export function getAiTimeoutMs(options = {}) {
  return Math.round(getAiTimeoutSeconds(options) * 1000);
}

export function getAiMaxSourceArtifactContentLength(
  options = {}
) {
  const config = readCradleConfig(options);
  return validatePositiveInteger(
    config.ai?.maxSourceArtifactContentLength,
    "ai.maxSourceArtifactContentLength"
  );
}

export function getAiMaxSourceArtifactOutputLength(
  options = {}
) {
  const config = readCradleConfig(options);
  return validatePositiveInteger(
    config.ai?.maxSourceArtifactOutputLength,
    "ai.maxSourceArtifactOutputLength"
  );
}

export function getProviderTimeoutSeconds(
  providerName,
  options = {}
) {
  const config = readCradleConfig(options);
  const value =
    config.providers?.[providerName]?.timeoutSeconds ??
    config.ai?.timeoutSeconds;

  return validateTimeoutSeconds(
    value,
    `providers.${providerName}.timeoutSeconds`
  );
}

export function getProviderTimeoutMs(providerName, options = {}) {
  return Math.round(
    getProviderTimeoutSeconds(providerName, options) * 1000
  );
}

export function getHeartbeatMode(options = {}) {
  const config = readCradleConfig(options);
  return config.heartbeat?.mode;
}

function validateTimeoutSeconds(value, pathName) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `Invalid runtime timeout seconds: ${pathName}`
    );
  }

  return value;
}

function validatePositiveInteger(value, pathName) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `Invalid runtime positive integer: ${pathName}`
    );
  }

  return value;
}
