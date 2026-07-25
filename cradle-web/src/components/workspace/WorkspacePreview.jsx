/** @import { WorkspaceFilePreview, WorkspaceNode } from "./workspace.types" */

function formatFileSize(size) {
  if (typeof size !== "number") {
    return "Unknown size";
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
  if (!node) {
    return (
      <div className="workspace-preview-empty">
        <h4>Select an item</h4>
        <p>Choose a folder or file from the workspace.</p>
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
          <span className="workspace-preview-kind">Directory</span>
        </div>

        <div className="workspace-preview-section-title">
          {node.childrenLoaded ? `${childNodes.length} item${childNodes.length === 1 ? "" : "s"}` : "Contents"}
        </div>
        {!node.childrenLoaded ? (
          <div className="workspace-preview-note">
            Open this directory to load its contents.
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
          <div className="workspace-preview-note">This directory is empty.</div>
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
          <span className="workspace-preview-kind">{formatFileSize(node.size)}</span>
        </div>
        <div className="workspace-file-placeholder">Loading preview...</div>
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
          <span className="workspace-preview-kind">{formatFileSize(node.size)}</span>
        </div>
        <div className="workspace-file-placeholder error">
          <strong>Unable to preview file</strong>
          <span>{fileError}</span>
          {onRetryFile && (
            <button type="button" onClick={onRetryFile}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (file && !file.previewable) {
    return (
      <div className="workspace-preview-content">
        <FileHeader node={node} file={file} />
        <div className="workspace-file-placeholder">
          <strong>Preview unavailable</strong>
          <span>{file.mimeType} files cannot be displayed.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-preview-content">
      <FileHeader node={node} file={file} />

      {file?.truncated && (
        <div className="workspace-preview-note warning">
          Preview truncated because this file is too large.
        </div>
      )}
      <pre className="workspace-code"><code>{file?.content ?? ""}</code></pre>
    </div>
  );
}

function FileHeader({ node, file }) {
  const size = formatFileSize(file?.size ?? node.size);
  const mimeType = file?.mimeType ?? node.mimeType ?? "unknown";
  const modifiedAt = file?.modifiedAt ?? node.modifiedAt;
  const meta = modifiedAt
    ? `${size} · ${mimeType} · ${formatModifiedAt(modifiedAt)}`
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

function formatModifiedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
