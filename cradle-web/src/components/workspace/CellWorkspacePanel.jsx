import { useCallback, useEffect, useRef, useState } from "react";
import {
  exportWorkspace,
  getWorkspace,
  getWorkspaceEntries,
  getWorkspaceFile,
} from "../../services/workspace-api";
import { WorkspacePreview } from "./WorkspacePreview";
import { WorkspaceTree } from "./WorkspaceTree";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

/** @import { WorkspaceFilePreview, WorkspaceNode } from "./workspace.types" */

/**
 * @param {{
 *   cellId: string;
 *   workspacePath?: string | null;
 * }} props
 */
export function CellWorkspacePanel({
  cellId,
  workspacePath,
}) {
  const { t } = useUiPreferences();
  const [displayPath, setDisplayPath] = useState(workspacePath);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedPaths, setExpandedPaths] = useState(() => new Set());
  const [loadingPaths, setLoadingPaths] = useState(() => new Set());
  const [failedPaths, setFailedPaths] = useState(() => new Map());
  const [isRootLoading, setIsRootLoading] = useState(false);
  const [rootError, setRootError] = useState(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const fileAbortRef = useRef(null);
  const rootAbortRef = useRef(null);
  const activeCellIdRef = useRef(cellId);
  const pathLabel = displayPath ?? workspacePath ?? t("workspace.pathUnavailable");

  useEffect(() => {
    setDisplayPath(workspacePath);
  }, [workspacePath]);

  const resetWorkspaceState = useCallback(() => {
    fileAbortRef.current?.abort();
    setNodes([]);
    setSelectedNode(null);
    setSelectedFile(null);
    setExpandedPaths(new Set());
    setLoadingPaths(new Set());
    setFailedPaths(new Map());
    setRootError(null);
    setFileError(null);
    setIsFileLoading(false);
    setIsExporting(false);
    setExportError(null);
  }, []);

  const loadWorkspaceRoot = useCallback(async (signal) => {
    setIsRootLoading(true);

    try {
      const [metadata, entriesResponse] = await Promise.all([
        getWorkspace(cellId, { signal }),
        getWorkspaceEntries(cellId, "", { signal }),
      ]);

      setDisplayPath(metadata.displayPath ?? workspacePath);
      setNodes(markChildrenLoaded(entriesResponse.entries ?? []));
    } catch (error) {
      if (error.name !== "AbortError") {
        setRootError(error.message);
      }
    } finally {
      if (!signal.aborted) {
        setIsRootLoading(false);
      }
    }
  }, [cellId, workspacePath]);

  useEffect(() => {
    if (!cellId) {
      resetWorkspaceState();
      return undefined;
    }

    activeCellIdRef.current = cellId;
    const controller = new AbortController();
    rootAbortRef.current?.abort();
    rootAbortRef.current = controller;
    resetWorkspaceState();
    void loadWorkspaceRoot(controller.signal);

    return () => {
      controller.abort();
    };
  }, [cellId, loadWorkspaceRoot, resetWorkspaceState]);

  async function loadChildren(path) {
    const requestedCellId = cellId;
    setLoadingPaths((current) => addSetValue(current, path));
    setFailedPaths((current) => deleteMapValue(current, path));

    try {
      const response = await getWorkspaceEntries(cellId, path);
      const children = markChildrenLoaded(response.entries ?? []);

      if (activeCellIdRef.current !== requestedCellId) {
        return;
      }

      setNodes((current) => replaceNodeChildren(current, path, children));
      setSelectedNode((current) =>
        current?.path === path
          ? { ...current, children, childrenLoaded: true }
          : current,
      );
    } catch (error) {
      if (activeCellIdRef.current !== requestedCellId) {
        return;
      }

      setFailedPaths((current) => setMapValue(current, path, error.message));
    } finally {
      if (activeCellIdRef.current === requestedCellId) {
        setLoadingPaths((current) => deleteSetValue(current, path));
      }
    }
  }

  function handleToggleDirectory(node) {
    setSelectedNode(node);
    setSelectedFile(null);
    setFileError(null);

    const isExpanded = expandedPaths.has(node.path);

    if (isExpanded) {
      setExpandedPaths((current) => deleteSetValue(current, node.path));
      return;
    }

    setExpandedPaths((current) => addSetValue(current, node.path));

    if (!node.childrenLoaded && node.hasChildren) {
      void loadChildren(node.path);
    }
  }

  function handleRetryDirectory(node) {
    setExpandedPaths((current) => addSetValue(current, node.path));
    void loadChildren(node.path);
  }

  function handleSelect(node) {
    setSelectedNode(node);

    if (node.type === "directory") {
      setSelectedFile(null);
      setFileError(null);
      return;
    }

    void loadFilePreview(node.path);
  }

  async function loadFilePreview(path) {
    fileAbortRef.current?.abort();

    const controller = new AbortController();
    fileAbortRef.current = controller;

    setSelectedFile(null);
    setFileError(null);
    setIsFileLoading(true);

    try {
      const file = await getWorkspaceFile(cellId, path, {
        signal: controller.signal,
      });
      setSelectedFile(file);
    } catch (error) {
      if (error.name !== "AbortError") {
        setFileError(error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsFileLoading(false);
      }
    }
  }

  function handleRetryRoot() {
    const controller = new AbortController();
    rootAbortRef.current?.abort();
    rootAbortRef.current = controller;
    setRootError(null);
    void loadWorkspaceRoot(controller.signal);
  }

  function handleRetryFile() {
    if (selectedNode?.type === "file") {
      void loadFilePreview(selectedNode.path);
    }
  }

  async function handleExportWorkspace() {
    if (!cellId || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const blob = await exportWorkspace(cellId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `${cellId}-workspace.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="workspace-card">
      <div className="workspace-card-header">
        <div className="workspace-heading">
          <h3>{t("workspace.cellWorkspace")}</h3>
          <p title={pathLabel}>{pathLabel}</p>
        </div>
        <button
          type="button"
          className="text-button workspace-export-button"
          disabled={!cellId || isExporting}
          onClick={handleExportWorkspace}
        >
          {t(isExporting ? "workspace.exporting" : "workspace.export")}
        </button>
      </div>
      {exportError && (
        <div className="workspace-export-error" role="alert">
          {exportError}
        </div>
      )}

      <div className="workspace-browser">
        <aside className="workspace-tree-panel">
          <div className="workspace-panel-title">{t("workspace.workspace")}</div>
          <WorkspaceTree
            nodes={nodes}
            selectedPath={selectedNode?.path}
            expandedPaths={expandedPaths}
            loadingPaths={loadingPaths}
            failedPaths={failedPaths}
            isLoading={isRootLoading}
            error={rootError}
            onSelect={handleSelect}
            onToggleDirectory={handleToggleDirectory}
            onRetryDirectory={handleRetryDirectory}
            onRetry={handleRetryRoot}
          />
        </aside>
        <main className="workspace-preview-panel">
          <WorkspacePreview
            node={selectedNode}
            file={selectedFile}
            isFileLoading={isFileLoading}
            fileError={fileError}
            onRetryFile={handleRetryFile}
          />
        </main>
      </div>
    </section>
  );
}

/**
 * @param {WorkspaceNode[]} entries
 * @returns {WorkspaceNode[]}
 */
function markChildrenLoaded(entries) {
  return entries.map((entry) => ({
    ...entry,
    children: entry.children ?? [],
    childrenLoaded: entry.type === "file" || !entry.hasChildren,
  }));
}

/**
 * @param {WorkspaceNode[]} nodes
 * @param {string} parentPath
 * @param {WorkspaceNode[]} children
 * @returns {WorkspaceNode[]}
 */
function replaceNodeChildren(nodes, parentPath, children) {
  return nodes.map((node) => {
    if (node.path === parentPath) {
      return {
        ...node,
        children,
        childrenLoaded: true,
      };
    }

    if (!node.children) {
      return node;
    }

    return {
      ...node,
      children: replaceNodeChildren(node.children, parentPath, children),
    };
  });
}

function addSetValue(current, value) {
  const next = new Set(current);
  next.add(value);
  return next;
}

function deleteSetValue(current, value) {
  const next = new Set(current);
  next.delete(value);
  return next;
}

function setMapValue(current, key, value) {
  const next = new Map(current);
  next.set(key, value);
  return next;
}

function deleteMapValue(current, key) {
  const next = new Map(current);
  next.delete(key);
  return next;
}
