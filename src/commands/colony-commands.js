import { renderAnswerStart } from "../cradle-ui.js";
import { renderColonyGraph } from "../ui/render-colony-graph.js";
import { renderTable } from "../ui/render-table.js";

export function createColonyCommands() {
  return [
    {
      name: "/ask",
      match: (input) => input.startsWith("/ask "),
      execute: async ({ engine, input }) => {
        const args = input.replace("/ask ", "").trim();
        const firstSpaceIndex = args.indexOf(" ");

        if (firstSpaceIndex === -1) {
          console.log("Usage: /ask <cell-id> <message>");
          return;
        }

        const targetCellId = args.slice(0, firstSpaceIndex).trim();
        const message = args.slice(firstSpaceIndex + 1).trim();
        const targetCell = engine.cells.get(targetCellId);

        if (!targetCell) {
          console.log(`Cell not found: ${targetCellId}`);
          return;
        }

        if (!message) {
          console.log("Usage: /ask <cell-id> <message>");
          return;
        }

        renderAnswerStart();
        await targetCell.ask(message);
      },
    },

    {
      name: "/broadcast",
      match: (input) => input.startsWith("/broadcast "),
      execute: async ({ engine, input }) => {
        const message = input.replace("/broadcast ", "").trim();

        if (!message) {
          console.log("Usage: /broadcast <message>");
          return;
        }

        for (const cellId of engine.cells.keys()) {
          await engine.pushMessage({
            from: engine.activeCellId,
            to: cellId,
            type: "broadcast",
            content: message,
          });
        }

        console.log(`Broadcast sent to ${engine.cells.size} cells.`);
      },
    },

    {
      name: "/run-all",
      match: (input) => input.startsWith("/run-all "),
      execute: async ({ engine, input }) => {
        const task = input.replace("/run-all ", "").trim();

        if (!task) {
          console.log("Usage: /run-all <task>");
          return;
        }

        for (const [id, targetCell] of engine.cells) {
          console.log(`\n========== ${id} ==========`);

          renderAnswerStart();

          await targetCell.ask(`
          你是 ${id}。

          請根據你的身份、記憶與能力，執行以下任務：

          ${task}
          `);
        }
      },
    },

   {
      name: "/work",

      match: (input) =>
        input === "/work",

      execute: async ({ engine }) => {
        const rows = [];

        for (const [id, cell] of engine.cells) {
          const inbox = await cell.readInbox();
          const tasks = await cell.readTasks();

          const pendingTasks =
            tasks.filter((task) => task.status === "pending");

          engine.inboxes.set(id, inbox);

          rows.push({
            Cell: id,
            Inbox: inbox.length,
            Tasks: pendingTasks.length,
            Action:
              inbox.length > 0
                ? "process"
                : pendingTasks.length > 0
                  ? "todo"
                  : "idle",
          });
        }

        console.log("");

        renderTable(
          ["Cell", "Inbox", "Tasks", "Action"],
          rows
        );
      },
    },

    {
      name: "/evolution-status",

      match: (input) =>
        input === "/evolution-status",

      execute: async ({ engine }) => {
        const rows = [];

        for (const [id, cell] of engine.cells) {
          const status = await cell.getEvolutionStatus();

          rows.push({
            Cell: id,
            Thoughts: status.totalThoughts,
            Unevolved: status.unevolvedThoughts,
            Evolved: status.evolvedThoughts,
            Evolutions: status.evolutionCount,
            Next: status.nextEvolutionIn,
            Last: status.lastEvolvedAt,
          });
        }

        console.log("");

        renderTable(
          [
            "Cell",
            "Thoughts",
            "Unevolved",
            "Evolved",
            "Evolutions",
            "Next",
            "Last",
          ],
          rows
        );
      },
    },

    {
      name: "/colony",

      match: (input) =>
        input === "/colony",

      execute: async ({ engine }) => {
        console.log("");
        console.log("🧫 Cradle Colony");
        console.log("");

        for (const [id, cell] of engine.cells) {
          const profile = await cell.getEvolutionInfo();
          const responsibilities = await cell.listResponsibilities();
          const relationships = await cell.listRelationships();
          const inboxCount = engine.inboxes.get(id)?.length ?? 0;

          console.log(id);
          console.log(` ├─ status: ${profile.status ?? "unknown"}`);
          console.log(` ├─ maturity: ${profile.maturity ?? 0}`);
          console.log(` ├─ generation: ${profile.generation ?? 1}`);
          console.log(` ├─ parent: ${profile.parent ?? "-"}`);
          console.log(` ├─ inbox: ${inboxCount}`);

          console.log(" ├─ responsibilities:");

          if (responsibilities.length === 0) {
            console.log(" │   └─ -");
          } else {
            for (const item of responsibilities) {
              console.log(` │   └─ ${item}`);
            }
          }

          console.log(" └─ relationships:");

          if (relationships.length === 0) {
            console.log("     └─ -");
          } else {
            for (const link of relationships) {
              console.log(`     └─ ${link.type} -> ${link.target}`);
            }
          }

          console.log("");
        }
      },
    },

    {
      name: "/colony-graph",

      match: (input) =>
        input === "/colony-graph",

      execute: async ({ engine }) => {
        const nodes = [];

        for (const [id, cell] of engine.cells) {
          const profile = await cell.getEvolutionInfo();
          const relationships = await cell.listRelationships();

          nodes.push({
            id,
            generation: profile.generation ?? 1,
            parent: profile.parent ?? null,
            relationships,
          });
        }

        renderColonyGraph(nodes);
      },
    },


  ];
}