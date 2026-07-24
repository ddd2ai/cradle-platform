import fs from "fs/promises";
import { renderColonyGraph } from "../ui/render-colony-graph.js";
import { dnaVectorToMatrix } from "../dna/dna-matrix.js";
import { CellFusionService } from "../lifecycle/cell-fusion-service.js";
import { block } from "../utils/text.js";
import { commandArgs } from "./command-input.js";
import { createColonyCommunicationCommands } from "./colony-communication-commands.js";
import { createFusionCommands } from "./fusion-commands.js";
import {
  renderColonyStatus,
  renderDnaMatrix,
  renderEvolutionStatusTable,
  renderLiveWatch,
  renderWorkTable,
} from "./colony-renderer.js";
import {
  buildDnaMatrixRows,
  buildEvolutionRows,
  buildWatchStatusRows,
  buildWorkRows,
} from "./colony-row-builders.js";

export function createColonyCommands({
  fusionServiceFactory = () => new CellFusionService(),
} = {}) {
  return [
    ...createColonyCommunicationCommands(),

    ...createFusionCommands({ fusionServiceFactory }),

   {
      name: "/work",

      match: (input) =>
        input === "/work",

      execute: async ({ engine }) => {
        renderWorkTable(await buildWorkRows(engine));
      },
    },

    {
      name: "/evolution-status",

      match: (input) =>
        input === "/evolution-status",

      execute: async ({ engine }) => {
        renderEvolutionStatusTable(await buildEvolutionRows(engine, {
          includeLast: true,
        }));
      },
    },

    {
      name: "/colony-dna",

      match: (input) =>
        input === "/colony-dna",

      execute: async ({ engine }) => {
        renderDnaMatrix(await buildDnaMatrixRows(engine));
      },
    },

    {
      name: "/colony",

      match: (input) =>
        input === "/colony",

      execute: async ({ engine }) => {
        const cells = [];

        for (const [id, cell] of engine.cells) {
          const profile = await cell.getEvolutionInfo();
          const maturity = await cell.getMaturityInfo();
          const responsibilities = await cell.listResponsibilities();
          const relationships = await cell.listRelationships();
          const inboxCount = engine.inboxes.get(id)?.length ?? 0;

          cells.push({
            id,
            status: profile.status,
            maturity,
            generation: profile.generation,
            parent: profile.parent,
            inboxCount,
            responsibilities,
            relationships,
          });
        }

        renderColonyStatus(cells);
      },
    },

    {
      name: "/colony-graph",

      match: (input) =>
        input === "/colony-graph",

      execute: async ({ engine }) => {
        const nodes = [];

        for (const [id, cell] of engine.cells) {
          const profile = await cell.getEvolutionInfo();
          const relationships = await cell.listRelationships();

          nodes.push({
            id,
            generation: profile.generation ?? 1,
            parent: profile.parent ?? null,
            relationships,
          });
        }

        renderColonyGraph(nodes);
      },
    },

    {
      name: "/watch",

      match: (input) =>
        input === "/watch",

      execute: async ({ engine }) => {
        if (engine.watchTimer) {
          console.log("Watch already running.");
          return;
        }

        engine.watchTimer = setInterval(async () => {
          const statusRows = await buildWatchStatusRows(engine);
          const workRows = await buildWorkRows(engine);
          const evolutionRows = await buildEvolutionRows(engine);

          renderLiveWatch({
            statusRows,
            workRows,
            evolutionRows,
          });
        }, 2000);

        console.log("Live watch started. Use /unwatch to stop.");
      },
    },

    {
      name: "/unwatch",

      match: (input) =>
        input === "/unwatch",

      execute: async ({ engine }) => {
        if (!engine.watchTimer) {
          console.log("Watch is not running.");
          return;
        }

        clearInterval(engine.watchTimer);
        engine.watchTimer = null;

        console.log("Watch stopped.");
      },
    },


  ];
}
