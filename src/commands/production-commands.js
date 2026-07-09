import { renderAnswerStart } from "../cradle-console.js";
import path from "path";

export function createProductionCommands() {
  return [
    {
      name: "/produce",
      match: (input, { engine }) =>
        input.startsWith("/produce ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();

        const args = input.replace("/produce ", "").trim();
        const firstSpaceIndex = args.indexOf(" ");

        if (firstSpaceIndex === -1) {
          console.log("Usage: /produce <type> <goal>");
          return;
        }

        const type = args.slice(0, firstSpaceIndex).trim();
        const goal = args.slice(firstSpaceIndex + 1).trim();

        if (!type || !goal) {
          console.log("Usage: /produce <type> <goal>");
          return;
        }

        renderAnswerStart();

        const result = await cell.produceArtifact({
          type,
          goal,
          title: goal.slice(0, 80),
        });

        // 產生 outputs 列表
        const outputsList = (result.artifact.outputs ?? [])
          .map((output) => `- ${output.path} [${output.language}]`)
          .join("\n");

        console.log(`
Artifact produced.

ID    : ${result.artifact.id}
Type  : ${result.artifact.type}
Title : ${result.artifact.title}
Dir   : ${path.relative(process.cwd(), result.saved.dir)}

Outputs:
${outputsList || "(no outputs)"}
`);
      },
    },

    {
      name: "/artifacts",
      match: (input, { engine }) =>
        input === "/artifacts" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const ids = await cell.productionService.store.listArtifacts();

        if (ids.length === 0) {
          console.log("(no artifacts)");
          return;
        }

        console.log(ids.join("\n"));
      },
    },
  ];
}

