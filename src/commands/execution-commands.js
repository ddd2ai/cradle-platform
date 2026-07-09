import { ArtifactExecutionService } from "../execution/artifact-execution-service.js";

export function createExecutionCommands() {
  return [
    {
      name: "/execute-artifact",
      match: (input, { engine }) =>
        input.startsWith("/execute-artifact ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const artifactId = input.replace("/execute-artifact ", "").trim();

        if (!artifactId) {
          console.log("❌ 請提供 artifact ID");
          console.log("用法: /execute-artifact <artifact-id>");
          return;
        }

        console.log(`\n🚀 執行 Artifact: ${artifactId}\n`);

        try {
          const executionService = new ArtifactExecutionService({
            cellWorkspaceDir: cell.workspace,
          });

          const result = await executionService.executeArtifact(artifactId);

          displayExecutionResult(result);
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
        const input = context.input.replace("/execute ", "/execute-artifact ");
        const commands = createExecutionCommands();
        const executeArtifactCommand = commands[0];
        await executeArtifactCommand.execute({ ...context, input });
      },
    },
  ];
}

function displayExecutionResult(result) {
  const statusSymbol = {
    passed: "✅",
    compile_failed: "❌",
    runtime_failed: "⚠️",
    error: "💥",
  };

  const statusText = {
    passed: "PASSED",
    compile_failed: "COMPILE FAILED",
    runtime_failed: "RUNTIME FAILED",
    error: "ERROR",
  };

  const symbol = statusSymbol[result.status] || "❓";
  const text = statusText[result.status] || result.status;

  console.log(`${symbol} Status: ${text}\n`);

  if (result.command) {
    console.log(`指令: ${result.command}\n`);
  }

  if (result.status === "passed") {
    console.log("✅ 執行成功\n");

    if (result.stdout) {
      console.log("Output:");
      console.log(result.stdout);
      console.log();
    }
  }

  if (result.status === "compile_failed") {
    console.log("❌ 編譯失敗\n");

    if (result.stderr) {
      console.log("Compiler Error:");
      console.error(result.stderr);
      console.log();
    }
  }

  if (result.status === "runtime_failed") {
    console.log("⚠️ 執行時錯誤\n");

    if (result.stdout) {
      console.log("stdout:");
      console.log(result.stdout);
      console.log();
    }

    if (result.stderr) {
      console.log("stderr:");
      console.error(result.stderr);
      console.log();
    }

    if (result.exitCode !== null) {
      console.log(`Exit Code: ${result.exitCode}\n`);
    }
  }

  if (result.status === "error") {
    console.log("💥 執行錯誤\n");

    if (result.error) {
      console.error(result.error);
      console.log();
    }
  }

  if (result.executionId) {
    console.log(`Execution ID: ${result.executionId}`);
  }

  if (result.createdAt) {
    console.log(`Created: ${result.createdAt}`);
  }
}
