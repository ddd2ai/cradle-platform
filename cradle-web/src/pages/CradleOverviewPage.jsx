import { useEffect, useMemo, useState } from "react";
import { fetchFoundation, updateFoundationDocument } from "../api/cradleClient";
import { useUiPreferences } from "../i18n/UiPreferencesProvider";

const DOCUMENT_LABEL_KEYS = {
  vision: "foundation.vision",
  environment: "foundation.environment",
  "dna-dimensions": "foundation.dnaDimensions",
  "dna-factors": "foundation.dnaFactors",
};

export function CradleOverviewPage() {
  const { t } = useUiPreferences();
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
      setMessage(t("foundation.saved", { name: documentLabel(saved, t) }));
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
          <h1>{t("nav.foundation")}</h1>
          <p>{t("foundation.description")}</p>
        </div>
        <div className="foundation-source-count">
          <strong>{documents.length}</strong>
          <span>{t("foundation.count")}</span>
        </div>
      </div>

      <div className="foundation-workspace">
        <aside className="definition-index" aria-label={t("foundation.definitions")}>
          <div className="definition-index-heading">
            <span>{t("foundation.definitions")}</span>
            <span className="definition-live-dot" aria-label={t("foundation.serverBacked")} />
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
                <strong>{documentLabel(item, t)}</strong>
                <small>{item.fileName}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className="definition-editor">
          {loading && <div className="foundation-state">{t("foundation.loading")}</div>}
          {!loading && error && !selected && <div className="foundation-state is-error">{error}</div>}
          {!loading && selected && (
            <>
              <header className="definition-editor-header">
                <div>
                  <h2>{documentLabel(selected, t)}</h2>
                  <p>{selected.fileName} · revision {selected.revision}</p>
                </div>
                <div className="definition-editor-controls">
                  <div className="definition-control-row">
                    <button type="button" className="secondary-button" disabled={!changed || saving} onClick={() => setDraft(selected.content)}>{t("foundation.reset")}</button>
                    <button type="button" className="primary-button" disabled={!changed || saving || draft.trim() === ""} onClick={saveDocument}>
                      {t(saving ? "foundation.saving" : "foundation.save")}
                    </button>
                  </div>
                  <span className={`definition-save-state ${error ? "is-error" : ""}`} role="status" aria-live="polite">
                    {error || message || t(changed ? "foundation.unsaved" : "foundation.upToDate")}
                  </span>
                </div>
              </header>
              <textarea
                className="definition-textarea"
                aria-label={`${documentLabel(selected, t)} ${t("foundation.definitions")}`}
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

function documentLabel(document, t) {
  return t(DOCUMENT_LABEL_KEYS[document?.id] ?? document?.label ?? "");
}
