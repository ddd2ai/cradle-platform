import { commandArgs } from "./command-input.js";
import { createCellMessageCommands } from "./cell-message-commands.js";
import { createCellProfileCommands } from "./cell-profile-commands.js";
import { createCellResponsibilityCommands } from "./cell-responsibility-commands.js";
import {
  renderCellGraph,
  renderCellTrace,
} from "./cell-relationship-renderer.js";

export function createCellCollaborationCommands() {
  return [
    ...createCellResponsibilityCommands(),

    {
      name: "/link",

      match: (input, { engine }) =>
        input.startsWith("/link ") &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = commandArgs(input, "/link").split(/\s+/);

        if (args.length < 2) {
          console.log("Usage: /link depends-on cell-002");

          return;
        }

        const type = args[0];
        const target = args[1];

        await cell.addRelationship(type, target);

        console.log(`${type} -> ${target}`);
      },
    },

    ...createCellProfileCommands(),

    {
      name: "/graph",

      match: (input, { engine }) =>
        input === "/graph" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const resp = await cell.listResponsibilities();
        const links = await cell.listRelationships();

        renderCellGraph({
          cellId: cell.id,
          responsibilities: resp,
          relationships: links,
        });
      },
    },

    ...createCellMessageCommands(),

    {
      name: "/trace",

      match: (input, { engine }) =>
        input === "/trace" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const profile = await cell.getProfile();
        const relationships = profile.relationships ?? [];

        renderCellTrace({
          cellId: cell.id,
          relationships,
        });
      },
    },
  ];
}
