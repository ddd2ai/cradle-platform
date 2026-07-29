export function CellFeedComposer({
  value,
  selectedCell,
  onChange,
  onSubmit,
  disabled,
}) {
  const targetLabel = selectedCell?.name ?? selectedCell?.id;
  const placeholder = selectedCell
    ? `Feed information to ${targetLabel}...`
    : "Select a Cell to begin feeding...";

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="cell-feed" aria-label="Feed information to selected Cell">
      <div
        className={[
          "cell-feed__composer",
          disabled ? "cell-feed__composer--disabled" : "",
        ].filter(Boolean).join(" ")}
      >
        <button
          type="button"
          className="cell-feed__attach"
          disabled={disabled}
          aria-label="Attach feeding material"
          title="Attach material"
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
          aria-label="Feed selected Cell"
          title="Feed Cell"
        >
          ↑
        </button>
      </div>
    </section>
  );
}
