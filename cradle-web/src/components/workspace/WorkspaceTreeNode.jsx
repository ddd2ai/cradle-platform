/** @import { WorkspaceNode } from "./workspace.types" */
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

function getFileIcon(node) {
  if (node.type === "directory") {
    return null;
  }

  return node.name.endsWith(".md") || node.name.endsWith(".txt") ? "TXT" : "FILE";
}

/**
 * @param {{
 *   node: WorkspaceNode;
 *   depth?: number;
 *   selectedPath?: string;
 *   expandedPaths: Set<string>;
 *   loadingPaths: Set<string>;
 *   failedPaths: Map<string, string>;
 *   onSelect: (node: WorkspaceNode) => void;
 *   onToggleDirectory: (node: WorkspaceNode) => void;
 *   onRetryDirectory: (node: WorkspaceNode) => void;
 * }} props
 */
export function WorkspaceTreeNode({
  node,
  depth = 0,
  selectedPath,
  expandedPaths,
  loadingPaths,
  failedPaths,
  onSelect,
  onToggleDirectory,
  onRetryDirectory,
}) {
  const { t } = useUiPreferences();
  const isDirectory = node.type === "directory";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const childNodes = node.children ?? [];
  const hasVisibleChildren = isDirectory && childNodes.length > 0;
  const isLoading = loadingPaths.has(node.path);
  const error = failedPaths.get(node.path);
  const rowClassName = `workspace-tree-row${isSelected ? " selected" : ""}`;

  function handleClick() {
    if (isDirectory) {
      onToggleDirectory(node);
      return;
    }

    onSelect(node);
  }

  return (
    <li className="workspace-tree-item">
      <button
        type="button"
        className={rowClassName}
        style={{ "--workspace-tree-depth": depth }}
        title={node.name}
        onClick={handleClick}
        aria-expanded={isDirectory ? isExpanded : undefined}
      >
        <span className="workspace-tree-chevron" aria-hidden="true">
          {isDirectory ? (isExpanded ? "⌄" : "›") : ""}
        </span>
        <span
          className={`workspace-tree-icon ${isDirectory ? "directory" : "file"}`}
          aria-hidden="true"
        >
          {isDirectory ? (isExpanded ? "□" : "▣") : getFileIcon(node)}
        </span>
        <span className="workspace-tree-name">{node.name}</span>
      </button>

      {hasVisibleChildren && isExpanded && (
        <ul className="workspace-tree-list nested">
          {childNodes.map((childNode) => (
            <WorkspaceTreeNode
              key={childNode.path}
              node={childNode}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              loadingPaths={loadingPaths}
              failedPaths={failedPaths}
              onSelect={onSelect}
              onToggleDirectory={onToggleDirectory}
              onRetryDirectory={onRetryDirectory}
            />
          ))}
        </ul>
      )}
      {isDirectory && isExpanded && isLoading && (
        <div
          className="workspace-tree-inline-state"
          style={{ "--workspace-tree-depth": depth + 1 }}
        >
          {t("common.loading")}
        </div>
      )}
      {isDirectory && isExpanded && error && (
        <div
          className="workspace-tree-inline-state error"
          style={{ "--workspace-tree-depth": depth + 1 }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => onRetryDirectory(node)}>
            {t("common.retry")}
          </button>
        </div>
      )}
    </li>
  );
}
