import { WorkspaceTreeNode } from "./WorkspaceTreeNode";

/** @import { WorkspaceNode } from "./workspace.types" */

/**
 * @param {{
 *   nodes: WorkspaceNode[];
 *   selectedPath?: string;
 *   isLoading?: boolean;
 *   error?: string | null;
 *   onSelect: (node: WorkspaceNode) => void;
 *   onRetry?: () => void;
 * }} props
 */
export function WorkspaceTree({
  nodes,
  selectedPath,
  isLoading = false,
  error = null,
  onSelect,
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
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
