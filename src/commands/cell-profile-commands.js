import { block } from "../utils/text.js";
import { commandArgs } from "./command-input.js";

export function createCellProfileCommands() {
  return [
    {
      name: "/profile",

      match: (input, { engine }) =>
        input === "/profile" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const profile = await cell.getProfile();
        const convergence = await cell.calculateConvergence();

        console.log(JSON.stringify({
          ...profile,
          convergence,
        }, null, 2));
      },
    },

    {
      name: "/specialize",

      match: (input, { engine }) =>
        input.startsWith("/specialize ") &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const role = commandArgs(input, "/specialize");

        if (!role) {
          console.log("Usage: /specialize <responsibility>");
          return;
        }

        await cell.addResponsibility(role);

        await cell.appendKnowledge(
          block([
            "## Specialization",
            "",
            "This cell has started specializing in:",
            "",
            role,
            "",
          ])
        );

        console.log(`Cell specialized: ${role}`);
      },
    },
  ];
}
