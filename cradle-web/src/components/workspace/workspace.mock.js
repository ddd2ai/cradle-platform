/** @import { WorkspaceNode } from "./workspace.types" */

/** @type {WorkspaceNode[]} */
export const mockWorkspaceNodes = [
  {
    name: "tasks",
    path: "tasks",
    type: "directory",
    hasChildren: true,
    children: [
      {
        name: "current-focus.md",
        path: "tasks/current-focus.md",
        type: "file",
        size: 1240,
        mimeType: "text/markdown",
      },
    ],
  },
  {
    name: "reviews",
    path: "reviews",
    type: "directory",
    hasChildren: false,
    children: [],
  },
  {
    name: "research",
    path: "research",
    type: "directory",
    hasChildren: true,
    children: [
      {
        name: "source-notes.txt",
        path: "research/source-notes.txt",
        type: "file",
        size: 2894,
        mimeType: "text/plain",
      },
    ],
  },
  {
    name: "publications",
    path: "publications",
    type: "directory",
    hasChildren: false,
    children: [],
  },
  {
    name: "projects",
    path: "projects",
    type: "directory",
    hasChildren: false,
    children: [],
  },
  {
    name: "productions",
    path: "productions",
    type: "directory",
    hasChildren: true,
    children: [
      {
        name: "artifact-20260723-194035",
        path: "productions/artifact-20260723-194035",
        type: "directory",
        hasChildren: true,
        children: [
          {
            name: "manifest.json",
            path: "productions/artifact-20260723-194035/manifest.json",
            type: "file",
            size: 842,
            mimeType: "application/json",
          },
        ],
      },
    ],
  },
  {
    name: "notes",
    path: "notes",
    type: "directory",
    hasChildren: true,
    children: [
      {
        name: "idea.md",
        path: "notes/idea.md",
        type: "file",
        size: 1568,
        mimeType: "text/markdown",
      },
    ],
  },
  {
    name: "executions",
    path: "executions",
    type: "directory",
    hasChildren: true,
    children: [
      {
        name: "execution-1784806934146",
        path: "executions/execution-1784806934146",
        type: "directory",
        hasChildren: true,
        children: [
          {
            name: "run-log.txt",
            path: "executions/execution-1784806934146/run-log.txt",
            type: "file",
            size: 4096,
            mimeType: "text/plain",
          },
        ],
      },
    ],
  },
  {
    name: "decisions",
    path: "decisions",
    type: "directory",
    hasChildren: false,
    children: [],
  },
  {
    name: "artifacts",
    path: "artifacts",
    type: "directory",
    hasChildren: false,
    children: [],
  },
];
