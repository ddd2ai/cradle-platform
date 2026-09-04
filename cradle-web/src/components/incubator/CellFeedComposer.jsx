import { useRef } from "react";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

export function CellFeedComposer({
  value,
  onChange,
  onSubmit,
  onFiles,
  artifactType = "",
  artifactTypes = [],
  onArtifactTypeChange = () => {},
  disabled,
  statusMessage,
  statusTone = "success",
}) {
  const { t } = useUiPreferences();
  const inputRef = useRef(null);
  const placeholder = t("incubator.feedPlaceholder");

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  function acceptFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length > 0) onFiles(files);
  }

  return (
    <section className="cell-feed" aria-label={t("incubator.feedLabel")}>
      {statusMessage ? (
        <div
          className={[
            "cell-feed__status",
            `cell-feed__status--${statusTone}`,
          ].join(" ")}
          aria-live="polite"
        >
          <span className="cell-feed__status-dot" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <div
        className={[
          "cell-feed__composer",
          disabled ? "cell-feed__composer--disabled" : "",
        ].filter(Boolean).join(" ")}
      >
        <input
          ref={inputRef}
          className="cell-feed__file-input"
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.txt,.md,.markdown,.csv,.json,.xml,.html,.htm,text/*,image/*,application/pdf"
          disabled={disabled}
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="cell-feed__attach"
          disabled={disabled}
          aria-label={t("incubator.attachLabel")}
          title={t("incubator.attach")}
          onClick={() => inputRef.current?.click()}
        >
          +
        </button>
        <div className="cell-feed__body">
          <label className="cell-feed__artifact-type">
            <span>{t("incubator.outputMode")}</span>
            <select
              value={artifactType}
              onChange={(event) => onArtifactTypeChange(event.target.value)}
              disabled={disabled}
              aria-label={t("incubator.outputMode")}
            >
              <option value="">{t("incubator.absorbOnly")}</option>
              {artifactTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.label} · {type.id}</option>
              ))}
            </select>
          </label>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label={placeholder}
          />
        </div>
        <button
          type="button"
          className="cell-feed__send"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label={t("incubator.cultivateText")}
          title={t("incubator.letGrow")}
        >
          ↑
        </button>
      </div>
    </section>
  );
}
