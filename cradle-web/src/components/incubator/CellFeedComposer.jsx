import { useRef } from "react";

export function CellFeedComposer({
  value,
  onChange,
  onSubmit,
  onFiles,
  disabled,
  statusMessage,
  statusTone = "success",
}) {
  const inputRef = useRef(null);
  const placeholder = "Feed Cradle. It will find the right Cell...";

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
    <section className="cell-feed" aria-label="Feed information to Cradle">
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
          aria-label="Attach feeding material"
          title="Attach material"
          onClick={() => inputRef.current?.click()}
        >
          +
        </button>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label={placeholder}
        />
        <button
          type="button"
          className="cell-feed__send"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Cultivate text stimulus"
          title="Let it grow"
        >
          ↑
        </button>
      </div>
    </section>
  );
}
