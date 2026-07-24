import { block } from "../utils/text.js";
import { commandArgs } from "./command-input.js";

export function createMemoryCommands() {
  return [
    {
      name: "/feed",
      match: (input, { engine }) => input.startsWith("/feed ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/feed");

        if (!content) {
          console.log("Usage: /feed <content>");
          return;
        }

        await cell.appendKnowledge(
          block([
            `## ${new Date().toISOString()}`,
            "",
            content,
            "",
          ])
        );
        console.log("Memory updated.");
      },
    },
  ];
}
