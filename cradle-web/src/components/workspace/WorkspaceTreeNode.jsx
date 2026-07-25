import { useState } from "react";

/** @import { WorkspaceNode } from "./workspace.types" */

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
 *   onSelect: (node: WorkspaceNode) => void;
 * }} props
 */
export function WorkspaceTreeNode({
  node,
  depth = 0,
  selectedPath,
  onSelect,
}) {
  const isDirectory = node.type === "directory";
  const [isExpanded, setIsExpanded] = useState(isDirectory && depth === 0);
  const isSelected = selectedPath === node.path;
  const childNodes = node.children ?? [];
  const hasVisibleChildren = isDirectory && childNodes.length > 0;
  const rowClassName = `workspace-tree-row${isSelected ? " selected" : ""}`;

  function handleClick() {
    onSelect(node);

    if (isDirectory) {
      setIsExpanded((current) => !current);
    }
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
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
