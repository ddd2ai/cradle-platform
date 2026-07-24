import { createEngineCellCommands } from "./engine-cell-commands.js";
import { createEngineStatusCommands } from "./engine-status-commands.js";
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

    ...createEngineCellCommands(),

    ...createEngineStatusCommands(),

    ...createHeartbeatCommands(),

    ...createEnvironmentCommands(),
  ];
}
