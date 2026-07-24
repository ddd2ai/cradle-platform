import fs from "fs/promises";
import { renderAnswerStart } from "../cradle-console.js";
import { renderColonyGraph } from "../ui/render-colony-graph.js";
import { dnaVectorToMatrix } from "../dna/dna-matrix.js";
import { CellFusionService } from "../lifecycle/cell-fusion-service.js";
import { block } from "../utils/text.js";
import { commandArgs, splitFirstArg } from "./command-input.js";
import { createFusionCommands } from "./fusion-commands.js";
import {
  renderColonyStatus,
  renderDnaMatrix,
  renderEvolutionStatusTable,
  renderWorkTable,
} from "./colony-renderer.js";

export function createColonyCommands({
  fusionServiceFactory = () => new CellFusionService(),
} = {}) {
  return [
    {
      name: "/ask",
      match: (input) => input.startsWith("/ask "),
      execute: async ({ engine, input }) => {
        const { first: targetCellId, rest: message } =
          splitFirstArg(input, "/ask");

        if (!targetCellId || !message) {
          console.log("Usage: /ask <cell-id> <message>");
          return;
        }

        const targetCell = engine.cells.get(targetCellId);

        if (!targetCell) {
          console.log(`Cell not found: ${targetCellId}`);
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
        const message = commandArgs(input, "/broadcast");

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

    ...createFusionCommands({ fusionServiceFactory }),

    {
      name: "/run-all",
      match: (input) => input.startsWith("/run-all "),
      execute: async ({ engine, input }) => {
        const task = commandArgs(input, "/run-all");

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

        renderWorkTable(rows);
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

        renderEvolutionStatusTable(rows);
      },
    },

    {
      name: "/colony-dna",

      match: (input) =>
        input === "/colony-dna",

      execute: async ({ engine }) => {

        const rows = [];

        for (const [id, cell] of engine.cells) {

          const dna =
            await cell.getDNARank();

          rows.push({
            Cell: id,
            "Dominant DNA":
              dna.dominantDNA,
            Score:
              dna.score.toFixed(2),

            PER:
              dna.scores.PERCEPTION.toFixed(2),

            DEC:
              dna.scores.DECISION.toFixed(2),

            DEP:
              dna.scores.DECOMPOSITION.toFixed(2),

            LEA:
              dna.scores.LEARNING.toFixed(2),

            COL:
              dna.scores.COLLABORATION.toFixed(2),

            CRE:
              dna.scores.CREATION.toFixed(2),

            EVO:
              dna.scores.EVOLUTION.toFixed(2),

            REF:
              dna.scores.REFLECTION.toFixed(2),
          });
        }

        renderDnaMatrix(rows);
      },
    },

    {
      name: "/colony",

      match: (input) =>
        input === "/colony",

      execute: async ({ engine }) => {
        const cells = [];

        for (const [id, cell] of engine.cells) {
          const profile = await cell.getEvolutionInfo();
          const maturity = await cell.getMaturityInfo();
          const responsibilities = await cell.listResponsibilities();
          const relationships = await cell.listRelationships();
          const inboxCount = engine.inboxes.get(id)?.length ?? 0;

          cells.push({
            id,
            status: profile.status,
            maturity,
            generation: profile.generation,
            parent: profile.parent,
            inboxCount,
            responsibilities,
            relationships,
          });
        }

        renderColonyStatus(cells);
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

    {
      name: "/watch",

      match: (input) =>
        input === "/watch",

      execute: async ({ engine }) => {
        if (engine.watchTimer) {
          console.log("Watch already running.");
          return;
        }

        engine.watchTimer = setInterval(async () => {
          console.clear();

          console.log("🧫 Cradle Live Watch");
          console.log(`Updated at: ${new Date().toLocaleString()}`);
          console.log("");

          // Status Table
          const statusRows = [];

          for (const [id, cell] of engine.cells) {
            const profile = await cell.getEvolutionInfo();
            const maturity = await cell.getMaturityInfo();
            const lifecycle = await cell.getLifecycleDecision();

            statusRows.push({
              Cell: id,
              Status: profile.status ?? "unknown",
              Active: cell.isActive() ? "yes" : "no",
              Mature: `${maturity.percent}%`,
              Life: lifecycle.action,
              State: maturity.state,
              Var: maturity.temporalVariance.toFixed(4),
              Conv: maturity.convergence.toFixed(2),
              Gen: profile.generation ?? 1,
              Inbox: engine.inboxes.get(id)?.length ?? 0,
            });
          }

          console.log("Status");
          renderTable(
            ["Cell", "Status", "Active", "Mature", "Life", "State", "Var", "Conv", "Gen", "Inbox"],
            statusRows
          );

          // Work Table
          const workRows = [];

          for (const [id, cell] of engine.cells) {
            const inbox = await cell.readInbox();
            const tasks = await cell.readTasks();

            const pendingTasks =
              tasks.filter((task) => task.status === "pending");

            engine.inboxes.set(id, inbox);

            workRows.push({
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
          console.log("Work");
          renderTable(
            ["Cell", "Inbox", "Tasks", "Action"],
            workRows
          );

          // Evolution Table
          const evolutionRows = [];

          for (const [id, cell] of engine.cells) {
            const status = await cell.getEvolutionStatus();

            evolutionRows.push({
              Cell: id,
              Thoughts: status.totalThoughts,
              Unevolved: status.unevolvedThoughts,
              Evolved: status.evolvedThoughts,
              Evolutions: status.evolutionCount,
              Next: status.nextEvolutionIn,
            });
          }

          console.log("");
          console.log("Evolution");
          renderTable(
            [
              "Cell",
              "Thoughts",
              "Unevolved",
              "Evolved",
              "Evolutions",
              "Next",
            ],
            evolutionRows
          );

          console.log("");
          console.log("Use /unwatch to stop live watch.");
        }, 2000);

        console.log("Live watch started. Use /unwatch to stop.");
      },
    },

    {
      name: "/unwatch",

      match: (input) =>
        input === "/unwatch",

      execute: async ({ engine }) => {
        if (!engine.watchTimer) {
          console.log("Watch is not running.");
          return;
        }

        clearInterval(engine.watchTimer);
        engine.watchTimer = null;

        console.log("Watch stopped.");
      },
    },


  ];
}
