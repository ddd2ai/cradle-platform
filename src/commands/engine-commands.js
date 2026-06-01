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
      name: "/merlin",
      match: (input) => input === "/merlin" || input === "/use Merlin",
      execute: async ({ engine }) => {
        engine.activeCellId = engine.MERLIN_ID;
        console.log("Returned to Merlin");
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

        console.log("");
        console.log("┌──────────┬──────────┬──────────┬──────────┬────────┐");
        console.log("│ Cell     │ Status   │ Mature   │ Gen      │ Inbox  │");
        console.log("├──────────┼──────────┼──────────┼──────────┼────────┤");

        for (const [id, cell] of engine.cells) {

          const profile =
            await cell.getEvolutionInfo();

          const inbox =
            engine.inboxes.get(id)?.length ?? 0;

          console.log(
            `│ ${String(id).padEnd(8)} │ ${String(profile.status).padEnd(8)} │ ${String(profile.maturity).padEnd(8)} │ ${String(profile.generation).padEnd(8)} │ ${String(inbox).padEnd(6)} │`
          );
        }

        console.log("└──────────┴──────────┴──────────┴──────────┴────────┘");
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

        if (id === engine.MERLIN_ID) {
          console.log("Merlin is reserved for Engine mode.");
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

        if (id === engine.MERLIN_ID) {
          engine.activeCellId = engine.MERLIN_ID;
          console.log("Returned to Merlin");
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
        if (engine.isMerlinMode()) {
          console.log(`
Mode      : Merlin
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
  ];
}