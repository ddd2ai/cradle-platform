import { commandArgs } from "./command-input.js";

export function createCellResponsibilityCommands() {
  return [
    {
      name: "/resp",

      match: (input, { engine }) =>
        input.startsWith("/resp ") &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = commandArgs(input, "/resp").split(/\s+/);

        const action = args[0];

        if (action === "add") {
          const name = args[1];

          if (!name) {
            console.log("Usage: /resp add <name>");
            return;
          }

          await cell.addResponsibility(name);
          console.log(`Responsibility added: ${name}`);
          return;
        }

        if (action === "list") {
          const items = await cell.listResponsibilities();

          console.log(items.join("\n"));

          return;
        }

        console.log("Usage: /resp add <name> | /resp list");
      },
    },
  ];
}
