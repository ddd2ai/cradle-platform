import { WorkspaceTreeNode } from "./WorkspaceTreeNode";

/** @import { WorkspaceNode } from "./workspace.types" */

/**
 * @param {{
 *   nodes: WorkspaceNode[];
 *   selectedPath?: string;
 *   expandedPaths: Set<string>;
 *   loadingPaths: Set<string>;
 *   failedPaths: Map<string, string>;
 *   isLoading?: boolean;
 *   error?: string | null;
 *   onSelect: (node: WorkspaceNode) => void;
 *   onToggleDirectory: (node: WorkspaceNode) => void;
 *   onRetryDirectory: (node: WorkspaceNode) => void;
 *   onRetry?: () => void;
 * }} props
 */
export function WorkspaceTree({
  nodes,
  selectedPath,
  expandedPaths,
  loadingPaths,
  failedPaths,
  isLoading = false,
  error = null,
  onSelect,
  onToggleDirectory,
  onRetryDirectory,
  onRetry,
}) {
  if (isLoading) {
    return <div className="workspace-tree-state">Loading workspace...</div>;
  }

  if (error) {
    return (
      <div className="workspace-tree-state error">
        <span>{error}</span>
        {onRetry && (
          <button type="button" className="workspace-retry-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (nodes.length === 0) {
    return <div className="workspace-tree-state">Workspace is empty.</div>;
  }

  return (
    <ul className="workspace-tree-list">
      {nodes.map((node) => (
        <WorkspaceTreeNode
          key={node.path}
          node={node}
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
  );
}
