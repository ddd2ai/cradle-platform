import { renderAnswerStart } from "../merlin-ui.js";

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
          engine.pushMessage({
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
  ];
}