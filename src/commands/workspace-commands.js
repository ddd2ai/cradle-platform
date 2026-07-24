import { renderAnswerStart } from "../cradle-console.js";
import { commandArgs, splitFirstArg } from "./command-input.js";
import {
  createWorkspaceRevisionPrompt,
  createWorkspaceWritePrompt,
} from "./cell-command-prompts.js";
import { renderWorkspaceSections } from "./cell-list-renderer.js";
import {
  createDecisionDocument,
  createNoteDocument,
  createProjectFileDocument,
  createProjectReadmeDocument,
  createResearchDocument,
} from "./workspace-document-templates.js";

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

    {
      name: "/read",
      match: (input, { engine }) => input.startsWith("/read ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const fileName = commandArgs(input, "/read");

        if (!fileName) {
          console.log("Usage: /read <workspace-file>");
          return;
        }

        try {
          const content = await cell.readWorkspaceFile(fileName);
          console.log(content);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
        }
      },
    },

    {
      name: "/revise",
      match: (input, { engine }) => input.startsWith("/revise ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: fileName, rest: task } =
          splitFirstArg(input, "/revise");

        if (!fileName || !task) {
          console.log("Usage: /revise <workspace-file> <task>");
          return;
        }

        let originalContent = "";

        try {
          originalContent = await cell.readWorkspaceFile(fileName);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
          return;
        }

        renderAnswerStart();

        const result = await cell.ask(
          createWorkspaceRevisionPrompt({
            task,
            originalContent,
          })
        );

        const outputText = engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        await cell.writeWorkspaceFile(fileName, outputText);

        console.log(`\nWorkspace file revised: ${fileName}`);
      },
    },

    {
      name: "/share",
      match: (input, { engine }) => input.startsWith("/share ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = commandArgs(input, "/share").split(/\s+/);

        if (args.length < 2) {
          console.log("Usage: /share <workspace-file> <target-cell-id>");
          return;
        }

        const [fileName, targetCellId] = args;
        const targetCell = engine.cells.get(targetCellId);

        if (!targetCell) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        try {
          const content = await cell.readWorkspaceFile(fileName);
          await targetCell.writeWorkspaceFile(fileName, content);

          console.log(`Shared ${fileName} from ${cell.id} to ${targetCellId}`);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
        }
      },
    },

    {
      name: "/import",
      match: (input, { engine }) => input.startsWith("/import ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = commandArgs(input, "/import").split(/\s+/);

        if (args.length < 2) {
          console.log("Usage: /import <source-cell-id> <workspace-file>");
          return;
        }

        const [sourceCellId, fileName] = args;
        const sourceCell = engine.cells.get(sourceCellId);

        if (!sourceCell) {
          console.log(`Source cell not found: ${sourceCellId}`);
          return;
        }

        try {
          const content = await sourceCell.readWorkspaceFile(fileName);
          await cell.writeWorkspaceFile(fileName, content);

          console.log(`Imported ${fileName} from ${sourceCellId} to ${cell.id}`);
        } catch {
          console.log(`Workspace file not found in ${sourceCellId}: ${fileName}`);
        }
      },
    },

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
