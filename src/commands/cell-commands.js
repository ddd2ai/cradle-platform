import { block } from "../utils/text.js";
import { commandArgs } from "./command-input.js";
import {
  renderDivisionBeforeChildFailure,
  renderDivisionReadiness,
  renderDivisionResult,
} from "./division-renderer.js";
import { createCellCollaborationCommands } from "./cell-collaboration-commands.js";
import { createCellIntrospectionCommands } from "./cell-introspection-commands.js";
import { createEvolutionCommands } from "./evolution-commands.js";
import { createInboxCommands } from "./inbox-commands.js";
import { createSnapshotCommands } from "./snapshot-commands.js";
import { createStimulusCommands } from "./stimulus-commands.js";
import { createTaskCommands } from "./task-commands.js";
import { createWorkspaceCommands } from "./workspace-commands.js";

export function createCellCommands() {
  return [
    ...createInboxCommands(),

    ...createCellIntrospectionCommands(),

    ...createStimulusCommands(),

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

    ...createWorkspaceCommands(),

    ...createSnapshotCommands(),

    ...createEvolutionCommands(),

    {
      name: "/divide",

      match: (input, { engine }) =>
        (
          input === "/divide" ||
          input.startsWith("/divide ")
        ) &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        // 引入 CellDivisionService
        const { CellDivisionService } = await import("../lifecycle/cell-division-service.js");

        const parent = engine.getActiveCell();

        const args = input.trim().split(/\s+/);

        if (args.length > 2) {
          console.log("Usage: /divide [child-cell-id]");
          return;
        }

        const rawChildId = args[1] ?? "";

        const childId =
          rawChildId ||
          `cell-${String(engine.cells.size + 1).padStart(3, "0")}`;

        if (engine.hasCell(childId)) {
          console.log(`Cell already exists: ${childId}`);
          return;
        }


        const maturity = await parent.getMaturityInfo();

        const decision = await parent.getLifecycleDecision();

        renderDivisionReadiness({
          parent,
          childId,
          maturity,
          decision,
        });


        // 使用 CellDivisionService 執行完整的 Division 流程
        const service = new CellDivisionService();

        console.log(`🧬 Starting Living Context Division...`);
        console.log(``);

        let result;
        try {
          result = await service.divide({
            engine,
            parentCell: parent,
            childId
          });
        } catch (error) {
          console.error(`❌ Division failed:`, error.message);
          return;
        }

        if (!result.child) {
          renderDivisionBeforeChildFailure(result);
          return;
        }

        renderDivisionResult({
          parent,
          result,
        });

        console.log(`Parent: ${parent.id}`);
        console.log(`Child: ${childId}`);


        if (result.complete) {
          engine.activeCellId = result.child.id;
          console.log(`Switched to ${result.child.id}`);
        }
      },
    },


    ...createCellCollaborationCommands(),

    ...createTaskCommands(),


  ];
}
