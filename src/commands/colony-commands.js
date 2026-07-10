import fs from "fs/promises";
import { renderAnswerStart } from "../cradle-console.js";
import { renderColonyGraph } from "../ui/render-colony-graph.js";
import { renderTable } from "../ui/render-table.js";
import { dnaVectorToMatrix } from "../dna/dna-matrix.js";
import { CellFusionService } from "../lifecycle/cell-fusion-service.js";
import { block } from "../utils/text.js";

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
      name: "/merge",
      match: (input) => input.startsWith("/merge "),
      execute: async ({ engine, input }) => {
        const args = input
          .replace("/merge ", "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        if (args.length < 3) {
          console.log("Usage: /merge <cell-a> <cell-b> <new-cell-id>");
          return;
        }

        const parentIds = args.slice(0, -1);
        const childId = args.at(-1);

        // 找到 Parent Cells
        const parentCells = [];
        
        for (const id of parentIds) {
          const cell = engine.cells.get(id);
          
          if (!cell) {
            console.log(`Cell not found: ${id}`);
            return;
          }
          
          parentCells.push(cell);
        }

        // 呼叫 CellFusionService
        console.log("");
        console.log("🧬 Starting Living Context Fusion...");
        console.log("");
        
        const service = new CellFusionService();
        
        try {
          const result = await service.fuse({
            engine,
            parentCells,
            childId
          });

          if (!result.success) {
            console.log("");
            console.log("❌ Fusion failed");
            console.log("");
            console.log("Errors:");
            
            for (const error of result.errors) {
              console.log(`  - ${error.stage}: ${error.message}`);
            }
            
            return;
          }

          // 顯示結果
          const child = result.child;
          const productionResult = result.productionResult;
          
          // 讀取 Living Context 資訊
          const livingContext = await child.readLivingContext();
          const profile = await child.readProfile();
          
          // 計算 Capabilities
          const fusionPlan = result.fusionPlan || {};
          const capabilityResolutions = fusionPlan.capabilityResolutions || [];
          
          const inherited = capabilityResolutions.filter(c => c.strategy === "inherit").length;
          const synthesized = capabilityResolutions.filter(c => c.strategy === "synthesize").length;
          const discarded = capabilityResolutions.filter(c => c.strategy === "discard").length;
          
          // 計算 Knowledge Conflicts
          const knowledgeConflicts = fusionPlan.knowledgeConflicts || [];
          const conflictsCount = knowledgeConflicts.length;
          const resolvedCount = knowledgeConflicts.filter(c => c.resolution).length;
          
          // 計算 Production
          const planned = (fusionPlan.productionPlan || []).length;
          const produced = productionResult.produced.length;
          const failed = productionResult.failed.length;
          
          // 設定 active cell
          engine.activeCellId = childId;

          // 顯示結果
          console.log("");
          console.log("🧬 Living Context Fusion Complete");
          console.log("");
          console.log("Parents");
          
          for (const parent of parentCells) {
            console.log(`  - ${parent.id}`);
          }
          
          console.log("");
          console.log(`Child          : ${childId}`);
          console.log(`Role           : ${profile.role || "unknown"}`);
          console.log(`Purpose        : ${livingContext.purpose || "unknown"}`);
          console.log("");
          console.log("Capabilities");
          console.log(`  Inherited      : ${inherited}`);
          console.log(`  Synthesized    : ${synthesized}`);
          console.log(`  Discarded      : ${discarded}`);
          console.log("");
          console.log("Knowledge");
          console.log(`  Conflicts      : ${conflictsCount}`);
          console.log(`  Resolved       : ${resolvedCount}`);
          console.log("");
          console.log("Production");
          console.log(`  Planned        : ${planned}`);
          console.log(`  Produced       : ${produced}`);
          console.log(`  Failed         : ${failed}`);
          console.log("");
          console.log(`Status         : ${result.complete ? "complete" : "production-incomplete"}`);
          console.log("");

        } catch (error) {
          console.log("");
          console.log("❌ Fusion failed");
          console.log("");
          console.log(error.message);
          console.log("");
          
          if (error.cause) {
            console.log("Cause:");
            console.log(error.cause.message);
          }
        }
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

        console.log("");
        console.log("DNA Matrix");

        renderTable(
          [
            "Cell",
            "Dominant DNA",
            "Score",
            "PER",
            "DEC",
            "DEP",
            "LEA",
            "COL",
            "CRE",
            "EVO",
            "REF",
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
          const maturity = await cell.getMaturityInfo();
          const responsibilities = await cell.listResponsibilities();
          const relationships = await cell.listRelationships();
          const inboxCount = engine.inboxes.get(id)?.length ?? 0;

          console.log(id);
          console.log(` ├─ status: ${profile.status ?? "unknown"}`);
          console.log(` ├─ maturity: ${maturity.percent}% (${maturity.state})`);
          console.log(` ├─ variance: ${maturity.temporalVariance.toFixed(6)}`);
          console.log(` ├─ convergence: ${maturity.convergence.toFixed(4)}`);
          console.log(` ├─ magnitude: ${maturity.normalizedMagnitude.toFixed(4)}`);
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