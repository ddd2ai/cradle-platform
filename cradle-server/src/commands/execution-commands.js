import { commandArgs } from "./command-input.js";
import { renderExecutionResult } from "./execution-result-renderer.js";
import { renderStabilityState } from "./stability-state-renderer.js";
import { renderStabilizationResult } from "./stabilization-result-renderer.js";

export function createExecutionCommands() {
  return [
    {
      name: "/execute-artifact",
      match: (input, { engine }) =>
        input.startsWith("/execute-artifact ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const artifactId = commandArgs(input, "/execute-artifact");

        if (!artifactId) {
          console.log("❌ 請提供 artifact ID");
          console.log("用法: /execute-artifact <artifact-id>");
          return;
        }

        console.log(`\n🚀 執行 Artifact: ${artifactId}\n`);

        try {
          const { result, stimulus } = await cell.executeArtifact(artifactId);

          renderExecutionResult(result);

          console.log(`
Stimulus created.

Category : ${stimulus.category}
File     : situation/stimuli/${stimulus.category}/${stimulus.file}
`);
        } catch (error) {
          console.log("\n❌ 執行失敗\n");
          console.error(error.message);

          if (error.stack) {
            console.error(`\n${error.stack}`);
          }
        }
      },
    },

    {
      name: "/execute",
      match: (input, { engine }) =>
        input.startsWith("/execute ") && !engine.isCradleMode(),

      execute: async (context) => {
        // /execute 是 /execute-artifact 的簡短別名
        const input = `/execute-artifact ${commandArgs(context.input, "/execute")}`;
        const commands = createExecutionCommands();
        const executeArtifactCommand = commands[0];
        await executeArtifactCommand.execute({ ...context, input });
      },
    },

    {
      name: "/stabilize",
      match: (input, { engine }) =>
        input.startsWith("/stabilize ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const artifactId = commandArgs(input, "/stabilize");

        if (!artifactId) {
          console.log("❌ 請提供 artifact ID");
          console.log("用法: /stabilize <artifact-id>");
          return;
        }

        console.log(`\n🌱 Stabilizing Artifact: ${artifactId}\n`);

        try {
          const result = await cell.stabilizeArtifact({
            artifactId,
            maxRounds: 3,
          });

          renderStabilizationResult(result);
        } catch (error) {
          console.log("\n❌ Stabilization failed\n");
          console.error(error.message);

          if (error.stack) {
            console.error(`\n${error.stack}`);
          }
        }
      },
    },

    {
      name: "/stability",
      match: (input, { engine }) =>
        input.startsWith("/stability ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const artifactId = commandArgs(input, "/stability");

        if (!artifactId) {
          console.log("❌ 請提供 artifact ID");
          console.log("用法: /stability <artifact-id>");
          return;
        }

        console.log(`\n📊 Artifact Stability State: ${artifactId}\n`);

        try {
          const state =
            await cell.stabilityStore.getArtifactState(artifactId);

          if (!state) {
            console.log(`No stability state found: ${artifactId}\n`);
            console.log("提示：使用 /stabilize <artifact-id> 來執行穩定化循環");
            return;
          }

          renderStabilityState(state);
        } catch (error) {
          console.log("\n❌ Failed to get stability state\n");
          console.error(error.message);

          if (error.stack) {
            console.error(`\n${error.stack}`);
          }
        }
      },
    },
  ];
}
