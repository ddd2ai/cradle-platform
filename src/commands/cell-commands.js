import path from "path";
import { renderAnswerStart } from "../cradle-console.js";
import { block } from "../utils/text.js";
import { getAiTimeoutMs } from "../cradle-config.js";
import { commandArgs, splitFirstArg } from "./command-input.js";
import { writeTextFile } from "../utils/text-file.js";
import {
  createPerceptionPrompt,
  createTaskArtifactPrompt,
} from "./cell-command-prompts.js";
import {
  renderDivisionBeforeChildFailure,
  renderDivisionReadiness,
  renderDivisionResult,
} from "./division-renderer.js";
import {
  createDelegationDocument,
  createReportMessage,
} from "./workspace-document-templates.js";
import {
  renderCellGraph,
  renderCellTrace,
} from "./cell-relationship-renderer.js";
import {
  renderStimuliList,
} from "./cell-list-renderer.js";
import { createCellIntrospectionCommands } from "./cell-introspection-commands.js";
import { createEvolutionCommands } from "./evolution-commands.js";
import { createInboxCommands } from "./inbox-commands.js";
import { createSnapshotCommands } from "./snapshot-commands.js";
import { createWorkspaceCommands } from "./workspace-commands.js";
import {
  renderMetabolismResult,
  renderTaskList,
} from "./cell-work-renderer.js";

export function createCellCommands() {
  return [
    ...createInboxCommands(),

    ...createCellIntrospectionCommands(),

    {
      name: "/observe",
      match: (input, { engine }) =>
        input === "/observe" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const stimuli = await cell.readStimuli();

        renderStimuliList(stimuli);
      },
    },

    {
      name: "/perceive",
      match: (input, { engine }) =>
        input === "/perceive" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const stimuli = await cell.readStimuli();

        if (stimuli.length === 0) {
          console.log("(no stimuli)");
          return;
        }

        renderAnswerStart();
        console.log("🧬 Reading situation stimuli...");
        console.log("🧠 Perceiving...");

        const result = await cell.askWithTimeout(
          createPerceptionPrompt({
            memoryContext: await cell.buildMemoryContext(),
            stimuli,
          }),
          getAiTimeoutMs()
        );

        const outputText = engine.cleanMarkdownFence(
          result?.text ?? result?.answer ?? ""
        );

        const filename =
          `observation-${engine.formatTimestamp(new Date())}.md`;

        await writeTextFile(
          path.join(cell.observationsDir, filename),
          outputText
        );

        console.log(`\nObservation created: situation/observations/${filename}`);
      },
    },

    {
      name: "/metabolize",
      match: (input, { engine }) =>
        input === "/metabolize" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log("🧬 Reading stimuli...");
        console.log("🧠 Creating tasks from situation...");

        const result = await cell.metabolize();

        renderMetabolismResult(result);
      },
    },

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


    {
      name: "/resp",

      match: (input,{engine}) =>
        input.startsWith("/resp ") &&
        !engine.isCradleMode(),

      execute: async ({engine,input}) => {

        const cell =
          engine.getActiveCell();

        const args =
          commandArgs(input, "/resp")
            .split(/\s+/);

        const action = args[0];

        if (action === "add") {
          const name = args[1];

          if (!name) {
            console.log("Usage: /resp add <name>");
            return;
          }

          await cell.addResponsibility(name);
          console.log(`Responsibility added: ${name}`);
          return;
        }

        if(action === "list") {

          const items =
            await cell.listResponsibilities();

          console.log(
            items.join("\n")
          );

          return;
        }

        console.log("Usage: /resp add <name> | /resp list");
      }
    },


    {
      name: "/link",

      match: (input,{engine}) =>
        input.startsWith("/link ") &&
        !engine.isCradleMode(),

      execute: async ({engine,input}) => {

        const cell =
          engine.getActiveCell();

        const args =
          commandArgs(input, "/link")
            .split(/\s+/);

        if(args.length < 2) {

          console.log(
            "Usage: /link depends-on cell-002"
          );

          return;
        }

        const type = args[0];
        const target = args[1];

        await cell.addRelationship(
          type,
          target
        );

        console.log(
          `${type} -> ${target}`
        );
      }
    },

    {
      name: "/profile",

      match: (input, { engine }) =>
        input === "/profile" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const profile = await cell.getProfile();
        const convergence = await cell.calculateConvergence();

        console.log(JSON.stringify({
          ...profile,
          convergence,
        }, null, 2));
      },
    },

    {
      name: "/specialize",

      match: (input, { engine }) =>
        input.startsWith("/specialize ") &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const role = commandArgs(input, "/specialize");

        if (!role) {
          console.log("Usage: /specialize <responsibility>");
          return;
        }

        await cell.addResponsibility(role);

        await cell.appendKnowledge(
          block([
            "## Specialization",
            "",
            "This cell has started specializing in:",
            "",
            role,
            "",
          ])
        );

        console.log(`Cell specialized: ${role}`);
      },
    },

    {
      name: "/tasks",
      match: (input, { engine }) =>
        input === "/tasks" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const tasks = await cell.readTasks();

        renderTaskList(tasks);
      },
    },

    {
      name: "/do",

      match: (input, { engine }) =>
        input === "/do" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const task = await cell.nextPendingTask();

        if (!task) {
          console.log("(no pending task)");
          return;
        }

        renderAnswerStart();

        const result = await cell.ask(createTaskArtifactPrompt(task));

        const outputText =
          engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        const filename = `artifacts/${task.id}.md`;

        await cell.writeWorkspaceFile(filename, outputText);
        await cell.completeTask(task.id);

        console.log(`\nArtifact created: ${filename}`);
      },
    },

    {
      name: "/graph",

      match: (input,{engine}) =>
        input === "/graph" &&
        !engine.isCradleMode(),

      execute: async ({engine}) => {

        const cell =
          engine.getActiveCell();

        const resp =
          await cell.listResponsibilities();

        const links =
          await cell.listRelationships();

        renderCellGraph({
          cellId: cell.id,
          responsibilities: resp,
          relationships: links,
        });
      }
    },

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

    {
      name: "/trace",

      match: (input, { engine }) =>
        input === "/trace" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const profile = await cell.getProfile();
        const relationships = profile.relationships ?? [];

        renderCellTrace({
          cellId: cell.id,
          relationships,
        });
      },
    },

  ];
}
