/** @import { WorkspaceFilePreview, WorkspaceNode } from "./workspace.types" */
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

function formatFileSize(size, t) {
  if (typeof size !== "number") {
    return t("workspace.unknownSize");
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPreviewItemIcon(node) {
  if (node.type === "directory") {
    return "DIR";
  }

  return node.name.endsWith(".md") || node.name.endsWith(".txt") ? "TXT" : "FILE";
}

/**
 * @param {{
 *   node?: WorkspaceNode | null;
 *   file?: WorkspaceFilePreview | null;
 *   isFileLoading?: boolean;
 *   fileError?: string | null;
 *   onRetryFile?: () => void;
 * }} props
 */
export function WorkspacePreview({
  node,
  file = null,
  isFileLoading = false,
  fileError = null,
  onRetryFile,
}) {
  const { locale, t } = useUiPreferences();
  if (!node) {
    return (
      <div className="workspace-preview-empty">
        <h4>{t("workspace.selectItem")}</h4>
        <p>{t("workspace.selectDescription")}</p>
      </div>
    );
  }

  if (node.type === "directory") {
    const childNodes = node.children ?? [];

    return (
      <div className="workspace-preview-content">
        <div className="workspace-preview-header">
          <div>
            <h4 title={node.name}>{node.name}</h4>
            <p title={node.path}>{node.path}</p>
          </div>
          <span className="workspace-preview-kind">{t("workspace.directory")}</span>
        </div>

        <div className="workspace-preview-section-title">
          {node.childrenLoaded ? t("workspace.itemCount", { count: childNodes.length }) : t("workspace.contents")}
        </div>
        {!node.childrenLoaded ? (
          <div className="workspace-preview-note">
            {t("workspace.openDirectory")}
          </div>
        ) : childNodes.length > 0 ? (
          <ul className="workspace-preview-list">
            {childNodes.map((childNode) => (
              <li key={childNode.path} title={childNode.name}>
                <span className={`workspace-preview-item-icon ${childNode.type}`}>
                  {getPreviewItemIcon(childNode)}
                </span>
                <span>{childNode.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="workspace-preview-note">{t("workspace.directoryEmpty")}</div>
        )}
      </div>
    );
  }

  if (isFileLoading) {
    return (
      <div className="workspace-preview-content">
        <div className="workspace-preview-header">
          <div>
            <h4 title={node.name}>{node.name}</h4>
            <p title={node.path}>{node.path}</p>
          </div>
          <span className="workspace-preview-kind">{formatFileSize(node.size, t)}</span>
        </div>
        <div className="workspace-file-placeholder">{t("workspace.previewLoading")}</div>
      </div>
    );
  }

  if (fileError) {
    return (
      <div className="workspace-preview-content">
        <div className="workspace-preview-header">
          <div>
            <h4 title={node.name}>{node.name}</h4>
            <p title={node.path}>{node.path}</p>
          </div>
          <span className="workspace-preview-kind">{formatFileSize(node.size, t)}</span>
        </div>
        <div className="workspace-file-placeholder error">
          <strong>{t("workspace.previewError")}</strong>
          <span>{fileError}</span>
          {onRetryFile && (
            <button type="button" onClick={onRetryFile}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (file && !file.previewable) {
    return (
      <div className="workspace-preview-content">
        <FileHeader node={node} file={file} locale={locale} t={t} />
        <div className="workspace-file-placeholder">
          <strong>{t("workspace.previewUnavailable")}</strong>
          <span>{t("workspace.mimeUnavailable", { type: file.mimeType })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-preview-content">
      <FileHeader node={node} file={file} locale={locale} t={t} />

      {file?.truncated && (
        <div className="workspace-preview-note warning">
          {t("workspace.previewTruncated")}
        </div>
      )}
      <pre className="workspace-code"><code>{file?.content ?? ""}</code></pre>
    </div>
  );
}

function FileHeader({ node, file, locale, t }) {
  const size = formatFileSize(file?.size ?? node.size, t);
  const mimeType = file?.mimeType ?? node.mimeType ?? "unknown";
  const modifiedAt = file?.modifiedAt ?? node.modifiedAt;
  const meta = modifiedAt
    ? `${size} · ${mimeType} · ${formatModifiedAt(modifiedAt, locale)}`
    : `${size} · ${mimeType}`;

  return (
    <div className="workspace-preview-header">
      <div>
        <h4 title={node.name}>{node.name}</h4>
        <p title={node.path}>{node.path}</p>
        <p>{meta}</p>
      </div>
      <span className="workspace-preview-kind">{size}</span>
    </div>
  );
}

function formatModifiedAt(value, locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale);
}
