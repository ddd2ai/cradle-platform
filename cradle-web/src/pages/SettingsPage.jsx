import { useEffect, useMemo, useState } from "react";
import { fetchCradleConfig, updateCradleConfig } from "../api/cradleClient";

const SETTINGS_SECTIONS = [
  {
    id: "ai-runtime",
    label: "Runtime",
    description: "Default provider, model, execution limits, and operation timeouts.",
  },
  {
    id: "providers",
    label: "Providers",
    description: "Provider-specific timeout overrides.",
  },
  {
    id: "cultivation",
    label: "Cultivation",
    description: "Configure how cultivation is triggered.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Configuration source and low-level settings.",
  },
];

const DEFAULT_SETTINGS = {
  ai: {
    defaultProvider: "ollama",
    defaultModel: "devstral-small-2:24b",
    timeoutSeconds: "3600",
    maxSourceArtifactOutputLength: "50000",
    maxSourceArtifactContentLength: "30000",
  },
  providers: {
    ollama: { timeoutSeconds: "3600" },
    copilot: { timeoutSeconds: "3600" },
    codex: { timeoutSeconds: "3600" },
    gemini: { timeoutSeconds: "3600" },
  },
  timeouts: {
    reflectionSeconds: "30",
    mavenExecutionSeconds: "3600",
  },
  heartbeatMode: "manual",
};

const PROVIDER_ROWS = [
  { id: "ollama", label: "Ollama Provider" },
  { id: "copilot", label: "Copilot Provider" },
  { id: "codex", label: "Codex Provider" },
  { id: "gemini", label: "Gemini Provider" },
];

const PROVIDER_OPTIONS = [
  {
    value: "ollama",
    label: "Ollama",
    models: ["devstral-small-2:24b", "gemma3:latest"],
  },
  {
    value: "copilot",
    label: "Copilot",
    models: ["gpt-5.5", "gpt-5.6", "gpt-5-mini"],
  },
  {
    value: "codex",
    label: "Codex",
    models: ["auto", "gpt-5.6"],
  },
  {
    value: "gemini",
    label: "Gemini",
    models: ["auto", "gemini-2.5-pro", "gemini-2.5-flash"],
  },
];

export function SettingsPage({ initialSectionId = "ai-runtime" } = {}) {
  const [selectedSectionId, setSelectedSectionId] = useState(initialSectionId);
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState(DEFAULT_SETTINGS);
  const [toastMessage, setToastMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedSection = useMemo(
    () => SETTINGS_SECTIONS.find((section) => section.id === selectedSectionId)
      ?? SETTINGS_SECTIONS[0],
    [selectedSectionId],
  );

  const hasUnsavedChanges =
    JSON.stringify(draftSettings) !== JSON.stringify(savedSettings);
  const validationError = validateDraftSettings(draftSettings);
  const canSave = hasUnsavedChanges && !validationError && !isSaving;

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setToastMessage(""), 2000);
    return () => window.clearTimeout(timerId);
  }, [toastMessage]);

  useEffect(() => {
    let cancelled = false;

    async function loadCradleConfig() {
      try {
        setLoadError("");
        const config = await fetchCradleConfig();
        const settings = mapConfigToSettings(config);

        if (!cancelled) {
          setSavedSettings(settings);
          setDraftSettings(settings);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message);
        }
      }
    }

    loadCradleConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateAiSetting(key, value) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      ai: {
        ...currentSettings.ai,
        ...(key === "defaultProvider"
          ? {
              defaultProvider: value,
              defaultModel: getDefaultModelForProvider(value),
            }
          : { [key]: value }),
      },
    }));
  }

  function updateProviderTimeout(providerId, value) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      providers: {
        ...currentSettings.providers,
        [providerId]: {
          ...currentSettings.providers[providerId],
          timeoutSeconds: value,
        },
      },
    }));
  }

  function updateTimeoutSetting(key, value) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      timeouts: {
        ...currentSettings.timeouts,
        [key]: value,
      },
    }));
  }

  function updateHeartbeatMode(value) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      heartbeatMode: value,
    }));
  }

  function handleReset() {
    setDraftSettings(savedSettings);
    setToastMessage("");
    setSaveError("");
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");
      const savedConfig = await updateCradleConfig(
        mapSettingsToConfig(draftSettings)
      );
      const saved = mapConfigToSettings(savedConfig);

      setSavedSettings(saved);
      setDraftSettings(saved);
      setToastMessage("Configuration saved");
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="settings-page" aria-label="Settings">
      <div className="settings-shell">
        <nav className="settings-nav" aria-label="Settings sections">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              type="button"
              key={section.id}
              className={`settings-nav-item ${
                selectedSectionId === section.id ? "selected" : ""
              }`}
              onClick={() => setSelectedSectionId(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <section className="settings-panel" aria-labelledby="settings-panel-title">
            <div className="settings-panel-header">
              <h2 id="settings-panel-title">{selectedSection.label}</h2>
              <p>{selectedSection.description}</p>
            </div>

            {loadError && (
              <div className="settings-load-error" role="alert">
                Unable to load configuration: {loadError}
              </div>
            )}

            {(validationError || saveError) && (
              <div className="settings-load-error" role="alert">
                {validationError || `Unable to save configuration: ${saveError}`}
              </div>
            )}

            {selectedSectionId === "ai-runtime" && (
              <RuntimeForm
                settings={draftSettings.ai}
                timeouts={draftSettings.timeouts}
                onChange={updateAiSetting}
                onChangeTimeout={updateTimeoutSetting}
              />
            )}

            {selectedSectionId === "providers" && (
              <ProvidersForm
                providers={draftSettings.providers}
                onChange={updateProviderTimeout}
              />
            )}

            {selectedSectionId === "cultivation" && (
              <CultivationForm
                heartbeatMode={draftSettings.heartbeatMode}
                onChange={updateHeartbeatMode}
              />
            )}

            {selectedSectionId === "advanced" && <AdvancedConfiguration />}
          </section>

          <div className="settings-save-bar" role="status" aria-live="polite">
            <span className={hasUnsavedChanges ? "settings-dirty" : ""}>
              {hasUnsavedChanges ? "Unsaved changes" : "No unsaved changes"}
            </span>
            <div className="settings-save-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleReset}
                disabled={!hasUnsavedChanges}
              >
                Reset
              </button>
              <button
                type="button"
                className="primary-button settings-save-button"
                onClick={handleSave}
                disabled={!canSave}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="settings-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </section>
  );
}

function mapConfigToSettings(config) {
  return {
    ai: {
      defaultProvider: String(config.ai?.defaultProvider ?? "ollama"),
      defaultModel: String(
        config.ai?.defaultModel
          ?? getDefaultModelForProvider(config.ai?.defaultProvider ?? "ollama")
      ),
      timeoutSeconds: stringifySetting(config.ai?.timeoutSeconds, "3600"),
      maxSourceArtifactOutputLength: stringifySetting(
        config.ai?.maxSourceArtifactOutputLength,
        "50000",
      ),
      maxSourceArtifactContentLength: stringifySetting(
        config.ai?.maxSourceArtifactContentLength,
        "30000",
      ),
    },
    providers: Object.fromEntries(
      PROVIDER_ROWS.map((provider) => [
        provider.id,
        {
          timeoutSeconds: stringifySetting(
            config.providers?.[provider.id]?.timeoutSeconds,
            "3600",
          ),
        },
      ]),
    ),
    timeouts: {
      reflectionSeconds: stringifySetting(
        config.timeouts?.reflectionSeconds,
        "30",
      ),
      mavenExecutionSeconds: stringifySetting(
        config.timeouts?.mavenExecutionSeconds,
        "3600",
      ),
    },
    heartbeatMode: normalizeHeartbeatMode(config.heartbeat?.mode),
  };
}

function stringifySetting(value, fallback) {
  return value === undefined || value === null ? fallback : String(value);
}

function normalizeHeartbeatMode(mode) {
  return mode === "automatic" ? "auto" : String(mode ?? "manual");
}

function mapSettingsToConfig(settings) {
  return {
    ai: {
      defaultProvider: settings.ai.defaultProvider,
      defaultModel: settings.ai.defaultModel,
      timeoutSeconds: parseIntegerSetting(settings.ai.timeoutSeconds),
      maxSourceArtifactOutputLength: parseIntegerSetting(
        settings.ai.maxSourceArtifactOutputLength
      ),
      maxSourceArtifactContentLength: parseIntegerSetting(
        settings.ai.maxSourceArtifactContentLength
      ),
    },
    providers: Object.fromEntries(
      PROVIDER_ROWS.map((provider) => [
        provider.id,
        {
          timeoutSeconds: parseIntegerSetting(
            settings.providers[provider.id].timeoutSeconds
          ),
        },
      ]),
    ),
    timeouts: {
      reflectionSeconds: parseIntegerSetting(settings.timeouts.reflectionSeconds),
      mavenExecutionSeconds: parseIntegerSetting(
        settings.timeouts.mavenExecutionSeconds
      ),
    },
    heartbeat: {
      mode: settings.heartbeatMode,
    },
  };
}

function validateDraftSettings(settings) {
  if (!settings.ai.defaultModel.trim()) {
    return "Default Model must not be empty.";
  }

  const positiveIntegerFields = [
    ["Default Timeout", settings.ai.timeoutSeconds],
    [
      "Source Artifact Output Limit",
      settings.ai.maxSourceArtifactOutputLength,
    ],
    [
      "Source Artifact Content Limit",
      settings.ai.maxSourceArtifactContentLength,
    ],
    ...PROVIDER_ROWS.map((provider) => [
      `${provider.label} Timeout`,
      settings.providers[provider.id].timeoutSeconds,
    ]),
    ["Reflection", settings.timeouts.reflectionSeconds],
    ["Maven Execution", settings.timeouts.mavenExecutionSeconds],
  ];

  for (const [label, value] of positiveIntegerFields) {
    if (!isPositiveIntegerString(value)) {
      return `${label} must be a positive integer.`;
    }
  }

  const outputLimit = parseIntegerSetting(
    settings.ai.maxSourceArtifactOutputLength
  );
  const contentLimit = parseIntegerSetting(
    settings.ai.maxSourceArtifactContentLength
  );

  if (contentLimit > outputLimit) {
    return "Source Artifact Content Limit must not exceed Source Artifact Output Limit.";
  }

  return "";
}

function isPositiveIntegerString(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function parseIntegerSetting(value) {
  return Number.parseInt(value, 10);
}

function RuntimeForm({ settings, timeouts, onChange, onChangeTimeout }) {
  const selectedProvider = PROVIDER_OPTIONS.find(
    (provider) => provider.value === settings.defaultProvider
  ) ?? PROVIDER_OPTIONS[0];
  const modelOptions = selectedProvider.models.includes(settings.defaultModel)
    ? selectedProvider.models
    : [settings.defaultModel, ...selectedProvider.models];

  return (
    <div className="settings-form-grid">
      <label className="settings-field">
        <span>Default Provider</span>
        <select
          className="settings-select"
          value={settings.defaultProvider}
          onChange={(event) => onChange("defaultProvider", event.target.value)}
        >
          {PROVIDER_OPTIONS.map((provider) => (
            <option key={provider.value} value={provider.value}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field">
        <span>Default Model</span>
        <select
          className="settings-select"
          value={settings.defaultModel}
          onChange={(event) => onChange("defaultModel", event.target.value)}
        >
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field">
        <span>Default Timeout</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={settings.timeoutSeconds}
            onChange={(event) => onChange("timeoutSeconds", event.target.value)}
          />
          <span>seconds</span>
        </span>
      </label>

      <label className="settings-field">
        <span>Source Artifact Output Limit</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={settings.maxSourceArtifactOutputLength}
            onChange={(event) =>
              onChange("maxSourceArtifactOutputLength", event.target.value)
            }
          />
          <span>characters</span>
        </span>
      </label>

      <label className="settings-field">
        <span>Source Artifact Content Limit</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={settings.maxSourceArtifactContentLength}
            onChange={(event) =>
              onChange("maxSourceArtifactContentLength", event.target.value)
            }
          />
          <span>characters</span>
        </span>
      </label>

      <label className="settings-field">
        <span>Reflection</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={timeouts.reflectionSeconds}
            onChange={(event) =>
              onChangeTimeout("reflectionSeconds", event.target.value)
            }
          />
          <span>seconds</span>
        </span>
      </label>

      <label className="settings-field">
        <span>Maven Execution</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={timeouts.mavenExecutionSeconds}
            onChange={(event) =>
              onChangeTimeout("mavenExecutionSeconds", event.target.value)
            }
          />
          <span>seconds</span>
        </span>
      </label>
    </div>
  );
}

function getDefaultModelForProvider(provider) {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.models[0]
    ?? "devstral-small-2:24b";
}

function ProvidersForm({ providers, onChange }) {
  return (
    <div className="settings-section-block">
      <div className="settings-form-grid">
        {PROVIDER_ROWS.map((provider) => (
          <label className="settings-field" key={provider.id}>
            <span>{provider.label}</span>
            <span className="settings-inline-control">
              <input
                className="settings-input"
                inputMode="numeric"
                value={providers[provider.id].timeoutSeconds}
                onChange={(event) => onChange(provider.id, event.target.value)}
              />
              <span>seconds</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CultivationForm({ heartbeatMode, onChange }) {
  return (
    <div className="settings-section-block">
      <h3>Cultivation</h3>
      <label className="settings-field">
        <span>Mode</span>
        <select
          className="settings-select"
          value={heartbeatMode}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="manual">Manual</option>
          <option value="auto">Auto</option>
        </select>
      </label>

      <div className="settings-explainer-list">
        <div>
          <strong>Manual</strong>
          <p>Runs only when cultivation is triggered explicitly.</p>
        </div>
        <div>
          <strong>Automatic</strong>
          <p>Runs cultivation on a configured schedule.</p>
        </div>
      </div>
    </div>
  );
}

function AdvancedConfiguration() {
  return (
    <div className="settings-section-block">
      <h3>Configuration</h3>
      <div className="settings-readonly-list">
        <div className="settings-readonly-row">
          <span>Source</span>
          <code>cradle-server/config/cradle-config.json</code>
        </div>
      </div>
      <p className="settings-muted-note">
        Configuration editing through the raw JSON file is not available yet.
      </p>
    </div>
  );
}
