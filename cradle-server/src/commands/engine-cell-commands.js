import { commandArgs } from "./command-input.js";

export function createEngineCellCommands() {
  return [
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
  ];
}
