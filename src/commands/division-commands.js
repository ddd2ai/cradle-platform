import {
  renderDivisionBeforeChildFailure,
  renderDivisionReadiness,
  renderDivisionResult,
} from "./division-renderer.js";

export function createDivisionCommands() {
  return [
    {
      name: "/divide",

      match: (input, { engine }) =>
        (
          input === "/divide" ||
          input.startsWith("/divide ")
        ) &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
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
  ];
}
