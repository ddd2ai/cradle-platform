import { useState } from "react";
import { mockWorkspaceNodes } from "./workspace.mock";
import { WorkspacePreview } from "./WorkspacePreview";
import { WorkspaceTree } from "./WorkspaceTree";

/** @import { WorkspaceNode } from "./workspace.types" */

/**
 * @param {{
 *   workspacePath?: string | null;
 *   nodes?: WorkspaceNode[];
 *   isLoading?: boolean;
 *   error?: string | null;
 * }} props
 */
export function CellWorkspacePanel({
  workspacePath,
  nodes = mockWorkspaceNodes,
  isLoading = false,
  error = null,
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const pathLabel = workspacePath ?? "Workspace path unavailable.";

  return (
    <section className="workspace-card">
      <div className="workspace-card-header">
        <div className="workspace-heading">
          <h3>Cell Workspace</h3>
          <p title={pathLabel}>{pathLabel}</p>
        </div>
        <button
          type="button"
          className="text-button workspace-export-button"
          disabled
          title="Workspace export will be available after the workspace API is connected."
        >
          Export Workspace
        </button>
      </div>

      <div className="workspace-browser">
        <aside className="workspace-tree-panel">
          <div className="workspace-panel-title">WORKSPACE</div>
          <WorkspaceTree
            nodes={nodes}
            selectedPath={selectedNode?.path}
            isLoading={isLoading}
            error={error}
            onSelect={setSelectedNode}
          />
        </aside>
        <main className="workspace-preview-panel">
          <WorkspacePreview node={selectedNode} />
        </main>
      </div>
    </section>
  );
}
