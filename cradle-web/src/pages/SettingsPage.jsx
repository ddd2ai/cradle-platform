import { useEffect, useMemo, useState } from "react";
import { fetchCradleConfig, updateCradleConfig } from "../api/cradleClient";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

const SETTINGS_SECTIONS = [
  {
    id: "ai-runtime",
    labelKey: "settings.runtime",
    descriptionKey: "settings.runtimeDescription",
  },
  {
    id: "providers",
    labelKey: "settings.providers",
    descriptionKey: "settings.providersDescription",
  },
  {
    id: "cultivation",
    labelKey: "settings.cultivation",
    descriptionKey: "settings.cultivationDescription",
  },
  {
    id: "advanced",
    labelKey: "settings.advanced",
    descriptionKey: "settings.advancedDescription",
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
    cultivationSeconds: "60",
    reflectionSeconds: "30",
    mavenExecutionSeconds: "3600",
  },
  runtime: {
    activationConcurrency: "4",
    llmConcurrency: "3",
  },
  heartbeatMode: "manual",
};

const PROVIDER_ROWS = [
  { id: "ollama", label: "Ollama" },
  { id: "copilot", label: "Copilot" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini" },
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
  const { t } = useUiPreferences();
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
  const validationError = validateDraftSettings(draftSettings, t);
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
      setToastMessage(t("settings.saved"));
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="settings-page" aria-label={t("nav.settings")}>
      <div className="settings-shell">
        <nav className="settings-nav" aria-label={t("settings.sections")}>
          {SETTINGS_SECTIONS.map((section) => (
            <button
              type="button"
              key={section.id}
              className={`settings-nav-item ${
                selectedSectionId === section.id ? "selected" : ""
              }`}
              onClick={() => setSelectedSectionId(section.id)}
            >
              {t(section.labelKey)}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <section className="settings-panel" aria-labelledby="settings-panel-title">
            <div className="settings-panel-header">
              <h2 id="settings-panel-title">{t(selectedSection.labelKey)}</h2>
              <p>{t(selectedSection.descriptionKey)}</p>
            </div>

            {loadError && (
              <div className="settings-load-error" role="alert">
                {t("settings.loadError", { error: loadError })}
              </div>
            )}

            {(validationError || saveError) && (
              <div className="settings-load-error" role="alert">
                {validationError || t("settings.saveError", { error: saveError })}
              </div>
            )}

            {selectedSectionId === "ai-runtime" && (
              <RuntimeForm
                settings={draftSettings.ai}
                timeouts={draftSettings.timeouts}
                onChange={updateAiSetting}
                onChangeTimeout={updateTimeoutSetting}
                t={t}
              />
            )}

            {selectedSectionId === "providers" && (
              <ProvidersForm
                providers={draftSettings.providers}
                onChange={updateProviderTimeout}
                t={t}
              />
            )}

            {selectedSectionId === "cultivation" && (
              <CultivationForm
                heartbeatMode={draftSettings.heartbeatMode}
                onChange={updateHeartbeatMode}
                t={t}
              />
            )}

            {selectedSectionId === "advanced" && <AdvancedConfiguration t={t} />}
          </section>

          <div className="settings-save-bar" role="status" aria-live="polite">
            <span className={hasUnsavedChanges ? "settings-dirty" : ""}>
              {t(hasUnsavedChanges ? "settings.unsaved" : "settings.noUnsaved")}
            </span>
            <div className="settings-save-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleReset}
                disabled={!hasUnsavedChanges}
              >
                {t("common.reset")}
              </button>
              <button
                type="button"
                className="primary-button settings-save-button"
                onClick={handleSave}
                disabled={!canSave}
              >
                {t(isSaving ? "settings.saving" : "settings.saveChanges")}
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
      cultivationSeconds: stringifySetting(
        config.timeouts?.cultivationSeconds,
        "60",
      ),
      reflectionSeconds: stringifySetting(
        config.timeouts?.reflectionSeconds,
        "30",
      ),
      mavenExecutionSeconds: stringifySetting(
        config.timeouts?.mavenExecutionSeconds,
        "3600",
      ),
    },
    runtime: {
      activationConcurrency: stringifySetting(
        config.runtime?.activationConcurrency,
        "4",
      ),
      llmConcurrency: stringifySetting(
        config.runtime?.llmConcurrency,
        "3",
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
      cultivationSeconds: parseIntegerSetting(settings.timeouts.cultivationSeconds),
      reflectionSeconds: parseIntegerSetting(settings.timeouts.reflectionSeconds),
      mavenExecutionSeconds: parseIntegerSetting(
        settings.timeouts.mavenExecutionSeconds
      ),
    },
    runtime: {
      activationConcurrency: parseIntegerSetting(settings.runtime.activationConcurrency),
      llmConcurrency: parseIntegerSetting(settings.runtime.llmConcurrency),
    },
    heartbeat: {
      mode: settings.heartbeatMode,
    },
  };
}

function validateDraftSettings(settings, t) {
  if (!settings.ai.defaultModel.trim()) {
    return t("settings.modelRequired");
  }

  const positiveIntegerFields = [
    [t("settings.defaultTimeout"), settings.ai.timeoutSeconds],
    [
      t("settings.outputLimit"),
      settings.ai.maxSourceArtifactOutputLength,
    ],
    [
      t("settings.contentLimit"),
      settings.ai.maxSourceArtifactContentLength,
    ],
    ...PROVIDER_ROWS.map((provider) => [
      t("settings.providerTimeout", { provider: provider.label }),
      settings.providers[provider.id].timeoutSeconds,
    ]),
    [t("settings.reflection"), settings.timeouts.reflectionSeconds],
    [t("settings.mavenExecution"), settings.timeouts.mavenExecutionSeconds],
  ];

  for (const [label, value] of positiveIntegerFields) {
    if (!isPositiveIntegerString(value)) {
      return t("settings.positiveInteger", { label });
    }
  }

  const outputLimit = parseIntegerSetting(
    settings.ai.maxSourceArtifactOutputLength
  );
  const contentLimit = parseIntegerSetting(
    settings.ai.maxSourceArtifactContentLength
  );

  if (contentLimit > outputLimit) {
    return t("settings.limitOrder");
  }

  return "";
}

function isPositiveIntegerString(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function parseIntegerSetting(value) {
  return Number.parseInt(value, 10);
}

function RuntimeForm({ settings, timeouts, onChange, onChangeTimeout, t }) {
  const selectedProvider = PROVIDER_OPTIONS.find(
    (provider) => provider.value === settings.defaultProvider
  ) ?? PROVIDER_OPTIONS[0];
  const modelOptions = selectedProvider.models.includes(settings.defaultModel)
    ? selectedProvider.models
    : [settings.defaultModel, ...selectedProvider.models];

  return (
    <div className="settings-form-grid">
      <label className="settings-field">
        <span>{t("settings.defaultProvider")}</span>
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
        <span>{t("settings.defaultModel")}</span>
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
        <span>{t("settings.defaultTimeout")}</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={settings.timeoutSeconds}
            onChange={(event) => onChange("timeoutSeconds", event.target.value)}
          />
          <span>{t("settings.seconds")}</span>
        </span>
      </label>

      <label className="settings-field">
        <span>{t("settings.outputLimit")}</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={settings.maxSourceArtifactOutputLength}
            onChange={(event) =>
              onChange("maxSourceArtifactOutputLength", event.target.value)
            }
          />
          <span>{t("settings.characters")}</span>
        </span>
      </label>

      <label className="settings-field">
        <span>{t("settings.contentLimit")}</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={settings.maxSourceArtifactContentLength}
            onChange={(event) =>
              onChange("maxSourceArtifactContentLength", event.target.value)
            }
          />
          <span>{t("settings.characters")}</span>
        </span>
      </label>

      <label className="settings-field">
        <span>{t("settings.reflection")}</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={timeouts.reflectionSeconds}
            onChange={(event) =>
              onChangeTimeout("reflectionSeconds", event.target.value)
            }
          />
          <span>{t("settings.seconds")}</span>
        </span>
      </label>

      <label className="settings-field">
        <span>{t("settings.mavenExecution")}</span>
        <span className="settings-inline-control">
          <input
            className="settings-input"
            inputMode="numeric"
            value={timeouts.mavenExecutionSeconds}
            onChange={(event) =>
              onChangeTimeout("mavenExecutionSeconds", event.target.value)
            }
          />
          <span>{t("settings.seconds")}</span>
        </span>
      </label>
    </div>
  );
}

function getDefaultModelForProvider(provider) {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.models[0]
    ?? "devstral-small-2:24b";
}

function ProvidersForm({ providers, onChange, t }) {
  return (
    <div className="settings-section-block">
      <div className="settings-form-grid">
        {PROVIDER_ROWS.map((provider) => (
          <label className="settings-field" key={provider.id}>
            <span>{t("settings.providerName", { provider: provider.label })}</span>
            <span className="settings-inline-control">
              <input
                className="settings-input"
                inputMode="numeric"
                value={providers[provider.id].timeoutSeconds}
                onChange={(event) => onChange(provider.id, event.target.value)}
              />
              <span>{t("settings.seconds")}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CultivationForm({ heartbeatMode, onChange, t }) {
  return (
    <div className="settings-section-block">
      <h3>{t("settings.cultivation")}</h3>
      <label className="settings-field">
        <span>{t("settings.mode")}</span>
        <select
          className="settings-select"
          value={heartbeatMode}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="manual">{t("settings.manual")}</option>
          <option value="auto">{t("settings.auto")}</option>
        </select>
      </label>

      <div className="settings-explainer-list">
        <div>
          <strong>{t("settings.manual")}</strong>
          <p>{t("settings.manualDescription")}</p>
        </div>
        <div>
          <strong>{t("settings.automatic")}</strong>
          <p>{t("settings.automaticDescription")}</p>
        </div>
      </div>
    </div>
  );
}

function AdvancedConfiguration({ t }) {
  return (
    <div className="settings-section-block">
      <h3>{t("settings.configuration")}</h3>
      <div className="settings-readonly-list">
        <div className="settings-readonly-row">
          <span>{t("settings.source")}</span>
          <code>cradle-server/config/cradle-config.json</code>
        </div>
      </div>
      <p className="settings-muted-note">
        {t("settings.rawUnavailable")}
      </p>
    </div>
  );
}
