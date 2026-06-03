import { renderTable } from "../ui/render-table.js";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import {
  resolveEnvironment
} from "../environment/environment-resolver.js";

import {
  isInstalled,
  installTool
} from "../environment/environment-installer.js";

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

          rows.push({
            Cell: id,
            Status: profile.status ?? "unknown",
            Mature: profile.maturity ?? 0,
            Gen: profile.generation ?? 1,
            Inbox: engine.inboxes.get(id)?.length ?? 0,
          });
        }

        console.log("");

        renderTable(
          ["Cell", "Status", "Mature", "Gen", "Inbox"],
          rows
        );
      },
    },

    {
      name: "/new",
      match: (input) => input.startsWith("/new "),
      execute: async ({ engine, input }) => {
        const id = input.replace("/new ", "").trim();

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
        const id = input.replace("/use ", "").trim();

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
      name: "/heartbeat",

      match: (input) =>
        input === "/heartbeat" ||
        input === "/tick",

      execute: async ({ engine }) => {
        await engine.tickAll();
      }
    },

    {
      name: "/env plan",

      match: (input) =>
        input === "/env plan",

      execute: async () => {

        const tools =
          await resolveEnvironment();

        if (tools.length === 0) {
          console.log("(no tools detected)");
          return;
        }

        console.log("");
        console.log("Environment Plan");
        console.log("");

        for (const tool of tools) {

          const installed =
            await isInstalled(tool);

          console.log(
            `${installed ? "✓" : "✗"} ${tool.name}`
          );
        }

        console.log("");
      }
    },

    {
      name: "/env prepare",

      match: (input) =>
        input === "/env prepare",

      execute: async () => {

        const tools =
          await resolveEnvironment();

        const rl =
          readline.createInterface({ input, output });

        try {
          console.log("");
          console.log("Preparing Environment");
          console.log("");

          for (const tool of tools) {

            const installed =
              await isInstalled(tool);

            if (installed) {
              console.log(`✓ ${tool.name}`);
              continue;
            }

            console.log(`✗ ${tool.name}`);
            console.log(`  install: ${tool.install}`);
            console.log("");

            const answer =
              await rl.question(
                `Install ${tool.name}? (Y/N) `
              );

            if (
              answer.trim().toUpperCase() !== "Y"
            ) {
              console.log(`Skipped ${tool.name}`);
              continue;
            }

            await installTool(tool);
            console.log(`✓ ${tool.name} installed`);
          }

          console.log("");
          console.log("Environment Ready");

        } finally {
          rl.close();
        }
      }
    },

  ];
}