import { commandArgs, splitFirstArg } from "./command-input.js";
import {
  createProjectFileDocument,
  createProjectReadmeDocument,
} from "./workspace-document-templates.js";

export function createProjectCommands() {
  return [
    {
      name: "/project-init",
      match: (input, { engine }) =>
        input.startsWith("/project-init ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const projectName = commandArgs(input, "/project-init");

        if (!projectName) {
          console.log("Usage: /project-init <project-name>");
          return;
        }

        await cell.writeWorkspaceFile(
          `projects/${projectName}/README.md`,
          createProjectReadmeDocument({
            projectName,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Project initialized: projects/${projectName}`);
      },
    },

    {
      name: "/project-file",
      match: (input, { engine }) =>
        input.startsWith("/project-file ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: projectName, rest: filePath } =
          splitFirstArg(input, "/project-file");

        if (!projectName || !filePath) {
          console.log("Usage: /project-file <project-name> <relative-file-path>");
          return;
        }

        await cell.writeWorkspaceFile(
          `projects/${projectName}/${filePath}`,
          createProjectFileDocument({
            cellId: cell.id,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Project file created: projects/${projectName}/${filePath}`);
      },
    },
  ];
}
