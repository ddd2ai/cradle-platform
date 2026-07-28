import { useEffect, useMemo, useState } from "react";

const SETTINGS_SECTIONS = [
  {
    id: "ai-runtime",
    label: "AI Runtime",
    description: "Default provider, model, and AI execution limits.",
  },
  {
    id: "providers",
    label: "Providers",
    description: "Provider-specific overrides will be configured in the next step.",
  },
  {
    id: "timeouts",
    label: "Timeouts",
    description: "Operation timeouts will be configured in the next step.",
  },
  {
    id: "cultivation",
    label: "Cultivation",
    description: "Cultivation behavior will be configured in the next step.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Configuration source details will be configured in the next step.",
  },
];

const DEFAULT_SETTINGS = {
  ai: {
    defaultProvider: "codex",
    defaultModel: "gpt-5.6",
    timeoutSeconds: "3600",
    maxSourceArtifactOutputLength: "50000",
    maxSourceArtifactContentLength: "30000",
  },
};

const PROVIDER_OPTIONS = [
  { value: "codex", label: "Codex" },
];

const MODEL_OPTIONS = [
  { value: "gpt-5.6", label: "gpt-5.6" },
];

export function SettingsPage() {
  const [selectedSectionId, setSelectedSectionId] = useState("ai-runtime");
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState(DEFAULT_SETTINGS);
  const [toastMessage, setToastMessage] = useState("");

  const selectedSection = useMemo(
    () => SETTINGS_SECTIONS.find((section) => section.id === selectedSectionId)
      ?? SETTINGS_SECTIONS[0],
    [selectedSectionId],
  );

  const hasUnsavedChanges =
    JSON.stringify(draftSettings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setToastMessage(""), 2000);
    return () => window.clearTimeout(timerId);
  }, [toastMessage]);

  function updateAiSetting(key, value) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      ai: {
        ...currentSettings.ai,
        [key]: value,
      },
    }));
  }

  function handleReset() {
    setDraftSettings(savedSettings);
    setToastMessage("");
  }

  function handleSave() {
    if (!hasUnsavedChanges) {
      return;
    }

    setSavedSettings(draftSettings);
    setToastMessage("Configuration saved");
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

            {selectedSectionId === "ai-runtime" ? (
              <AiRuntimeForm settings={draftSettings.ai} onChange={updateAiSetting} />
            ) : (
              <div className="settings-empty-state">
                This section is reserved for the next Settings step.
              </div>
            )}
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
                disabled={!hasUnsavedChanges}
              >
                Save changes
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

function AiRuntimeForm({ settings, onChange }) {
  return (
    <div className="settings-form-grid">
      <label className="settings-field">
        <span>Default Provider</span>
        <select
          className="settings-select"
          value={settings.defaultProvider}
          onChange={(event) => onChange("defaultProvider", event.target.value)}
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
          {MODEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
    </div>
  );
}
