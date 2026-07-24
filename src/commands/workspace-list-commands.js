import { renderWorkspaceSections } from "./cell-list-renderer.js";

export function createWorkspaceListCommands() {
  return [
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
