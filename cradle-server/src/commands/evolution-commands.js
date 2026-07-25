import fs from "fs/promises";
import {
  renderEvolutionFileList,
} from "./cell-list-renderer.js";
import { renderEvolutionResult } from "./cell-work-renderer.js";

export function createEvolutionCommands() {
  return [
    {
      name: "/evolve",

      match: (input, { engine }) =>
        input === "/evolve" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log("🧬 Evolving from thoughts...");

        const result = await cell.evolve({
          force: true,
        });

        renderEvolutionResult(result);
      },
    },

    {
      name: "/evolution",

      match: (input, { engine }) =>
        input === "/evolution" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const content = await cell.readLatestEvolution();

        console.log(content ?? "No evolution found.");
      },
    },

    {
      name: "/evolutions",

      match: (input, { engine }) =>
        input === "/evolutions" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const files = await fs.readdir(cell.evolutionsDir);

        renderEvolutionFileList(files);
      },
    },
  ];
}
