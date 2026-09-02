import { useEffect, useMemo, useState } from "react";
import { fetchFoundation, updateFoundationDocument } from "../api/cradleClient";

export function CradleOverviewPage() {
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState("vision");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? null,
    [documents, selectedId],
  );
  const changed = Boolean(selected) && draft !== selected.content;

  useEffect(() => {
    let cancelled = false;
    fetchFoundation()
      .then((result) => {
        if (cancelled) return;
        setDocuments(result.documents ?? []);
        setDraft(result.documents?.[0]?.content ?? "");
      })
      .catch((loadError) => !cancelled && setError(loadError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  function selectDocument(id) {
    const next = documents.find((item) => item.id === id);
    setSelectedId(id);
    setDraft(next?.content ?? "");
    setMessage("");
    setError("");
  }

  async function saveDocument() {
    if (!selected || !changed || saving) return;
    try {
      setSaving(true);
      setError("");
      const saved = await updateFoundationDocument(selected.id, {
        content: draft,
        expectedRevision: selected.revision,
      });
      setDocuments((current) => current.map((item) => item.id === saved.id ? saved : item));
      setDraft(saved.content);
      setMessage(`${saved.label} saved`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="platform-page foundation-page">
      <div className="page-heading foundation-heading">
        <div>
          <h1>Foundation</h1>
          <p>Define the shared conditions that shape every Cell in this Cradle.</p>
        </div>
        <div className="foundation-source-count">
          <strong>{documents.length}</strong>
          <span>authoritative definitions</span>
        </div>
      </div>

      <div className="foundation-workspace">
        <aside className="definition-index" aria-label="Definitions">
          <div className="definition-index-heading">
            <span>Definitions</span>
            <span className="definition-live-dot" aria-label="Server backed" />
          </div>
          {documents.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`definition-item ${selectedId === item.id ? "selected" : ""}`}
              onClick={() => selectDocument(item.id)}
            >
              <span className={`definition-glyph definition-glyph--${item.kind}`} aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.fileName}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className="definition-editor">
          {loading && <div className="foundation-state">Loading definitions…</div>}
          {!loading && error && !selected && <div className="foundation-state is-error">{error}</div>}
          {!loading && selected && (
            <>
              <header className="definition-editor-header">
                <div>
                  <h2>{selected.label}</h2>
                  <p>{selected.fileName} · revision {selected.revision}</p>
                </div>
                <div className="definition-editor-controls">
                  <div className="definition-control-row">
                    <button type="button" className="secondary-button" disabled={!changed || saving} onClick={() => setDraft(selected.content)}>Reset</button>
                    <button type="button" className="primary-button" disabled={!changed || saving || draft.trim() === ""} onClick={saveDocument}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                  <span className={`definition-save-state ${error ? "is-error" : ""}`} role="status" aria-live="polite">
                    {error || message || (changed ? "Unsaved changes" : "Up to date")}
                  </span>
                </div>
              </header>
              <textarea
                className="definition-textarea"
                aria-label={`${selected.label} definition`}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setMessage("");
                }}
                spellCheck="false"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
