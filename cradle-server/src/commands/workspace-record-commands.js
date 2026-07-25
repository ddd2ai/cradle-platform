import { commandArgs } from "./command-input.js";
import {
  createDecisionDocument,
  createNoteDocument,
  createResearchDocument,
} from "./workspace-document-templates.js";

export function createWorkspaceRecordCommands() {
  return [
    {
      name: "/write-note",
      match: (input, { engine }) =>
        input.startsWith("/write-note ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/write-note");

        if (!content) {
          console.log("Usage: /write-note <content>");
          return;
        }

        const filename = `notes/note-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          createNoteDocument({
            content,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Note created: ${filename}`);
      },
    },

    {
      name: "/decide",
      match: (input, { engine }) =>
        input.startsWith("/decide ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/decide");

        if (!content) {
          console.log("Usage: /decide <decision>");
          return;
        }

        const filename = `decisions/decision-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          createDecisionDocument({
            content,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Decision created: ${filename}`);
      },
    },

    {
      name: "/research",
      match: (input, { engine }) =>
        input.startsWith("/research ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/research");

        if (!content) {
          console.log("Usage: /research <content>");
          return;
        }

        const filename = `research/research-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          createResearchDocument({
            content,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Research created: ${filename}`);
      },
    },
  ];
}
