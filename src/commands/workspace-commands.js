import { createProjectCommands } from "./project-commands.js";
import { createWorkspaceDraftCommands } from "./workspace-draft-commands.js";
import { createWorkspaceFileCommands } from "./workspace-file-commands.js";
import { createWorkspaceListCommands } from "./workspace-list-commands.js";
import { createWorkspaceRecordCommands } from "./workspace-record-commands.js";

export function createWorkspaceCommands() {
  return [
    ...createWorkspaceDraftCommands(),

    ...createWorkspaceRecordCommands(),

    ...createWorkspaceFileCommands(),

    ...createProjectCommands(),

    ...createWorkspaceListCommands(),
  ];
}
