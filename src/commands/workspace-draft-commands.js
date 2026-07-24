import { renderAnswerStart } from "../cradle-console.js";
import { commandArgs } from "./command-input.js";
import { createWorkspaceWritePrompt } from "./cell-command-prompts.js";

export function createWorkspaceDraftCommands() {
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
  ];
}
