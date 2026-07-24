import { renderAnswerStart } from "../cradle-console.js";
import { commandArgs } from "./command-input.js";
import { createWorkspaceWritePrompt } from "./cell-command-prompts.js";
import { renderWorkspaceSections } from "./cell-list-renderer.js";
import { createProjectCommands } from "./project-commands.js";
import { createWorkspaceFileCommands } from "./workspace-file-commands.js";
import { createWorkspaceRecordCommands } from "./workspace-record-commands.js";

export function createWorkspaceCommands() {
  return [
    {
      name: "/write",
      match: (input, { engine }) => input.startsWith("/write ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/write");

        if (!content) {
          console.log("Usage: /write <task>");
          return;
        }

        const filename = `artifacts/note-${engine.formatTimestamp(new Date())}.md`;

        renderAnswerStart();

        const result = await cell.ask(createWorkspaceWritePrompt(content));

        const outputText = engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        await cell.writeWorkspaceFile(filename, outputText);

        console.log(`\nWorkspace file created: ${filename}`);
      },
    },

    ...createWorkspaceRecordCommands(),

    ...createWorkspaceFileCommands(),

    ...createProjectCommands(),

    {
      name: "/workspace",
      match: (input, { engine }) =>
        input === "/workspace" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const sections = await cell.listWorkspaceSections();

        renderWorkspaceSections(sections);
      },
    },
  ];
}
