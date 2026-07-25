export function renderExecutionResult(result) {
  const statusSymbol = {
    passed: "✅",
    compile_failed: "❌",
    runtime_failed: "⚠️",
    error: "💥",
    skipped: "⏭️",
  };

  const statusText = {
    passed: "PASSED",
    compile_failed: "COMPILE FAILED",
    runtime_failed: "RUNTIME FAILED",
    error: "ERROR",
    skipped: "SKIPPED",
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

  if (result.status === "skipped") {
    console.log("⏭️ 此 Artifact 不需要執行\n");

    if (result.stdout) {
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
