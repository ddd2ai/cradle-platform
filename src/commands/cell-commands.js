import { createCellCollaborationCommands } from "./cell-collaboration-commands.js";
import { createCellIntrospectionCommands } from "./cell-introspection-commands.js";
import { createDivisionCommands } from "./division-commands.js";
import { createEvolutionCommands } from "./evolution-commands.js";
import { createInboxCommands } from "./inbox-commands.js";
import { createMemoryCommands } from "./memory-commands.js";
import { createSnapshotCommands } from "./snapshot-commands.js";
import { createStimulusCommands } from "./stimulus-commands.js";
import { createTaskCommands } from "./task-commands.js";
import { createWorkspaceCommands } from "./workspace-commands.js";

export function createCellCommands() {
  return [
    ...createInboxCommands(),

    ...createCellIntrospectionCommands(),

    ...createStimulusCommands(),

    ...createMemoryCommands(),

    ...createWorkspaceCommands(),

    ...createSnapshotCommands(),

    ...createEvolutionCommands(),

    ...createDivisionCommands(),


    ...createCellCollaborationCommands(),

    ...createTaskCommands(),


  ];
}
