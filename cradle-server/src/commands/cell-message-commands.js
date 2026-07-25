import { splitFirstArg } from "./command-input.js";
import {
  createDelegationDocument,
  createReportMessage,
} from "./workspace-document-templates.js";

export function createCellMessageCommands() {
  return [
    {
      name: "/delegate",

      match: (input, { engine }) =>
        input.startsWith("/delegate ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: targetCellId, rest: task } =
          splitFirstArg(input, "/delegate");

        if (!targetCellId || !task) {
          console.log("Usage: /delegate <cell-id> <task>");
          return;
        }

        if (!engine.cells.has(targetCellId)) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        await engine.pushMessage({
          from: cell.id,
          to: targetCellId,
          type: "delegation",
          content: task,
        });

        await cell.addRelationship("delegated-to", targetCellId);

        await cell.writeWorkspaceFile(
          `decisions/delegation-${engine.formatTimestamp(new Date())}.md`,
          createDelegationDocument({
            fromCellId: cell.id,
            targetCellId,
            task,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Delegated task from ${cell.id} to ${targetCellId}`);
      },
    },

    {
      name: "/report",

      match: (input, { engine }) =>
        input.startsWith("/report ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: targetCellId, rest: fileName } =
          splitFirstArg(input, "/report");

        if (!targetCellId || !fileName) {
          console.log("Usage: /report <cell-id> <workspace-file>");
          return;
        }

        const targetCell = engine.cells.get(targetCellId);

        if (!targetCell) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        let content = "";

        try {
          content = await cell.readWorkspaceFile(fileName);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
          return;
        }

        await engine.pushMessage({
          from: cell.id,
          to: targetCellId,
          type: "report",
          content: createReportMessage({
            fromCellId: cell.id,
            fileName,
            content,
          }),
        });

        await cell.addRelationship("reported-to", targetCellId);

        console.log(`Report sent from ${cell.id} to ${targetCellId}`);
      },
    },
  ];
}
