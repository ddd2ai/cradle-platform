/** @import { WorkspaceNode } from "./workspace.types" */

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
 * @param {{ node?: WorkspaceNode | null }} props
 */
export function WorkspacePreview({ node }) {
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

        <div className="workspace-preview-section-title">Contents</div>
        {childNodes.length > 0 ? (
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

  return (
    <div className="workspace-preview-content">
      <div className="workspace-preview-header">
        <div>
          <h4 title={node.name}>{node.name}</h4>
          <p title={node.path}>{node.path}</p>
        </div>
        <span className="workspace-preview-kind">{formatFileSize(node.size)}</span>
      </div>

      <div className="workspace-file-placeholder">
        File preview will be available after the workspace API is connected.
      </div>
    </div>
  );
}
