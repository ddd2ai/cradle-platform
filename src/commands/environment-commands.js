import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import {
  resolveEnvironment
} from "../environment/environment-resolver.js";
import {
  isInstalled,
  installTool
} from "../environment/environment-installer.js";

export function createEnvironmentCommands({
  resolveEnvironmentFn = resolveEnvironment,
  isInstalledFn = isInstalled,
  installToolFn = installTool,
  createReadlineInterface = () => readline.createInterface({ input, output }),
} = {}) {
  return [
    {
      name: "/env plan",

      match: (input) =>
        input === "/env plan",

      execute: async () => {

        const tools =
          await resolveEnvironmentFn();

        if (tools.length === 0) {
          console.log("(no tools detected)");
          return;
        }

        console.log("");
        console.log("Environment Plan");
        console.log("");

        for (const tool of tools) {

          const installed =
            await isInstalledFn(tool);

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
          await resolveEnvironmentFn();

        const rl =
          createReadlineInterface();

        try {
          console.log("");
          console.log("Preparing Environment");
          console.log("");

          for (const tool of tools) {

            const installed =
              await isInstalledFn(tool);

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

            await installToolFn(tool);
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
