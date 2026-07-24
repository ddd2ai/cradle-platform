import { renderWorkspaceSections } from "./cell-list-renderer.js";
import { createProjectCommands } from "./project-commands.js";
import { createWorkspaceDraftCommands } from "./workspace-draft-commands.js";
import { createWorkspaceFileCommands } from "./workspace-file-commands.js";
import { createWorkspaceRecordCommands } from "./workspace-record-commands.js";

export function createWorkspaceCommands() {
  return [
    ...createWorkspaceDraftCommands(),

    ...createWorkspaceRecordCommands(),

    ...createWorkspaceFileCommands(),

    ...createProjectCommands(),

    {
      name: "/workspace",
      match: (input, { engine }) =>
        input === "/workspace" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const sections = await cell.listWorkspaceSections();

        renderWorkspaceSections(sections);
      },
    },
  ];
}
