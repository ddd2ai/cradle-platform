import { block } from "../utils/text.js";
import { commandArgs, splitFirstArg } from "./command-input.js";
import {
  createDelegationDocument,
  createReportMessage,
} from "./workspace-document-templates.js";
import {
  renderCellGraph,
  renderCellTrace,
} from "./cell-relationship-renderer.js";

export function createCellCollaborationCommands() {
  return [
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
