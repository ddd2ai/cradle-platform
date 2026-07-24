import { renderTable } from "../ui/render-table.js";
import { commandArgs } from "./command-input.js";
import { createEnvironmentCommands } from "./environment-commands.js";
import { createHeartbeatCommands } from "./heartbeat-commands.js";

export function createEngineCommands() {
  return [
    {
      name: "/help",
      match: (input) => input === "/help",
      execute: async ({ engine }) => {
        engine.printHelp();
      },
    },

    {
      name: "/cradle",
      match: (input) => input === "/cradle" || input === "/use Cradle",
      execute: async ({ engine }) => {
        engine.activeCellId = engine.CRADLE_ID;
        console.log("Returned to Cradle");
      },
    },

    {
      name: "/cells",
      match: (input) => input === "/cells",
      execute: async ({ engine }) => {
        console.log([...engine.cells.keys()].join("\n"));
      },
    },

    {
      name: "/status",
      match: (input) => input === "/status",

      execute: async ({ engine }) => {
        const rows = [];

        for (const [id, cell] of engine.cells) {
          const profile = await cell.getEvolutionInfo();
          const maturity = await cell.getMaturityInfo();
          const lifecycle = await cell.getLifecycleDecision();

          rows.push({
            Cell: id,
            Status: profile.status ?? "unknown",
            Active: cell.isActive() ? "yes" : "no",
            Mature: `${maturity.percent}%`,
            Life: lifecycle.action,
            State: maturity.state,
            Var: maturity.temporalVariance.toFixed(4),
            Conv: maturity.convergence.toFixed(2),
            Gen: profile.generation ?? 1,
            Inbox: engine.inboxes.get(id)?.length ?? 0,
          });
        }

        console.log("");

        renderTable(
          ["Cell", "Status", "Active", "Mature", "Life", "State", "Var", "Conv", "Gen", "Inbox"],
          rows
        );
      },
    },

    {
      name: "/new",
      match: (input) => input.startsWith("/new "),
      execute: async ({ engine, input }) => {
        const id = commandArgs(input, "/new");

        if (!id) {
          console.log("Usage: /new cell-002");
          return;
        }

        if (id === engine.CRADLE_ID) {
          console.log("Cradle is reserved for Engine mode.");
          return;
        }

        if (engine.cells.has(id)) {
          console.log(`Cell already exists: ${id}`);
          return;
        }

        await engine.createCell(id);
        engine.activeCellId = id;

        console.log(`Created and switched to ${id}`);
      },
    },

    {
      name: "/use",
      match: (input) => input.startsWith("/use "),
      execute: async ({ engine, input }) => {
        const id = commandArgs(input, "/use");

        if (id === engine.CRADLE_ID) {
          engine.activeCellId = engine.CRADLE_ID;
          console.log("Returned to Cradle");
          return;
        }

        if (!engine.cells.has(id)) {
          console.log(`Cell not found: ${id}`);
          return;
        }

        engine.activeCellId = id;
        console.log(`Switched to ${id}`);
      },
    },

    {
      name: "/whoami",
      match: (input) => input === "/whoami",
      execute: async ({ engine }) => {
        if (engine.isCradleMode()) {
          console.log(`
          Mode      : Cradle
          Role      : Engine Console
          Model     : ${engine.model}
          Cells     : ${engine.cells.size}
          `);
          return;
        }

        const cell = engine.getActiveCell();

        console.log(`
        Cell ID   : ${cell.id}
        Cell Name : ${cell.name}
        Model     : ${cell.model}
        Inbox     : ${engine.inboxes.get(cell.id)?.length ?? 0}
        `);
      },
    },

    {
      name: "/activate",
      match: (input) => input.startsWith("/activate "),
      execute: async ({ engine, input }) => {
        const cellId = commandArgs(input, "/activate");

        if (!cellId) {
          console.log("Usage: /activate <cell-id>");
          return;
        }

        await engine.activateCell(cellId);
      },
    },

    {
      name: "/deactivate",
      match: (input) => input.startsWith("/deactivate "),
      execute: async ({ engine, input }) => {
        const cellId = commandArgs(input, "/deactivate");

        if (!cellId) {
          console.log("Usage: /deactivate <cell-id>");
          return;
        }

        await engine.deactivateCell(cellId);
      },
    },

    {
      name: "/activate-all",
      match: (input) => input === "/activate-all",
      execute: async ({ engine }) => {
        await engine.activateAllCells();
      },
    },

    {
      name: "/deactivate-all",
      match: (input) => input === "/deactivate-all",
      execute: async ({ engine }) => {
        await engine.deactivateAllCells();
      },
    },

    ...createHeartbeatCommands(),

    ...createEnvironmentCommands(),

  ];
}
