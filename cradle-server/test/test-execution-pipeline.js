/**
 * Execution Pipeline 測試
 * 
 * 測試 executable-java artifact 的完整流程：
 * 1. 產生 executable-java artifact
 * 2. 驗證 artifact
 * 3. 執行 artifact
 * 4. 檢查執行結果
 */

import { CradleCell } from "../src/cradle-cell.js";
import { ArtifactExecutionService } from "../src/execution/artifact-execution-service.js";
import fs from "fs/promises";
import path from "path";

const PROVIDER = process.env.PROVIDER || "ollama";
const MODEL = process.env.MODEL || "gemma:7b";
const CELL_ID = "test-execution-cell";

console.log("=== Execution Pipeline 測試 ===\n");
console.log(`Provider: ${PROVIDER}`);
console.log(`Model: ${MODEL}`);
console.log();

async function setupTestCell() {
  // 清理舊的測試 cell
  await fs.rm(`cells/${CELL_ID}`, { recursive: true, force: true });

  const cell = new CradleCell({
    id: CELL_ID,
    name: "Execution Test Cell",
    provider: PROVIDER,
    model: MODEL,
  });

  await cell.prepare();

  return cell;
}

async function testCase1_HelloService(cell) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("測試案例 1: HelloService");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // 產生 artifact
    const result = await cell.produceArtifact({
      type: "executable-java",
      goal: "寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle",
      title: "HelloService Java Class",
    });

    const artifact = result.artifact;

    console.log(`✓ Artifact 產生成功: ${artifact.id}`);
    console.log(`  Type: ${artifact.type}`);
    console.log(`  Outputs: ${artifact.outputs.length}`);

    // 驗證檔案
    const output = artifact.outputs[0];
    if (!output.path.includes("HelloService.java")) {
      throw new Error(`❌ 檔名錯誤: ${output.path}`);
    }
    console.log(`✓ 檔名正確: ${output.path}`);

    if (!output.content.includes("class HelloService")) {
      throw new Error("❌ content 缺少 HelloService class");
    }
    console.log("✓ content 包含 class HelloService");

    if (!output.content.includes("sayHello")) {
      throw new Error("❌ content 缺少 sayHello 方法");
    }
    console.log("✓ content 包含 sayHello 方法");

    if (!output.content.includes("public static void main(String[] args)")) {
      throw new Error("❌ content 缺少 main 方法");
    }
    console.log("✓ content 包含 main 方法");

    // 執行 artifact
    console.log("\n執行 artifact...\n");

    const executionService = new ArtifactExecutionService({
      cellWorkspaceDir: cell.workspace,
    });

    const executionResult = await executionService.executeArtifact(artifact.id);

    console.log(`Status: ${executionResult.status}`);
    console.log(`Command: ${executionResult.command}`);

    if (executionResult.status === "passed") {
      console.log(`\nOutput:\n${executionResult.stdout}`);

      if (executionResult.stdout.includes("Hello Cradle")) {
        console.log("\n✅ 測試案例 1: PASS");
        return { status: "PASS", artifactId: artifact.id, executionResult };
      } else {
        console.log("\n❌ 測試案例 1: FAIL");
        console.log("  原因: 輸出不包含 'Hello Cradle'");
        return { status: "FAIL", artifactId: artifact.id, executionResult };
      }
    } else if (executionResult.status === "compile_failed") {
      console.log("\n❌ 測試案例 1: FAIL");
      console.log("  原因: 編譯失敗");
      console.log(`\nCompiler Error:\n${executionResult.stderr}`);
      return { status: "FAIL", artifactId: artifact.id, executionResult };
    } else {
      console.log("\n❌ 測試案例 1: FAIL");
      console.log(`  原因: 執行失敗 (${executionResult.status})`);
      if (executionResult.stderr) {
        console.log(`\nError:\n${executionResult.stderr}`);
      }
      return { status: "FAIL", artifactId: artifact.id, executionResult };
    }
  } catch (error) {
    console.log("\n❌ 測試案例 1: FAIL");
    console.log(`  錯誤: ${error.message}`);
    return { status: "FAIL", error: error.message };
  }
}

async function testCase2_Calculator(cell) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("測試案例 2: Calculator");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    const result = await cell.produceArtifact({
      type: "executable-java",
      goal: "寫一個 Java class,名稱為 Calculator,包含 add 方法,在 main 方法中輸出 Calculator.add(2, 3) 的結果",
      title: "Calculator Java Class",
    });

    const artifact = result.artifact;

    console.log(`✓ Artifact 產生成功: ${artifact.id}`);

    const executionService = new ArtifactExecutionService({
      cellWorkspaceDir: cell.workspace,
    });

    const executionResult = await executionService.executeArtifact(artifact.id);

    console.log(`Status: ${executionResult.status}`);

    if (executionResult.status === "passed") {
      console.log(`\nOutput:\n${executionResult.stdout}`);

      if (executionResult.stdout.includes("5")) {
        console.log("\n✅ 測試案例 2: PASS");
        return { status: "PASS", artifactId: artifact.id, executionResult };
      } else {
        console.log("\n❌ 測試案例 2: FAIL");
        console.log("  原因: 輸出不包含 '5'");
        return { status: "FAIL", artifactId: artifact.id, executionResult };
      }
    } else {
      console.log("\n❌ 測試案例 2: FAIL");
      console.log(`  原因: ${executionResult.status}`);
      if (executionResult.stderr) {
        console.log(`\nError:\n${executionResult.stderr}`);
      }
      return { status: "FAIL", artifactId: artifact.id, executionResult };
    }
  } catch (error) {
    console.log("\n❌ 測試案例 2: FAIL");
    console.log(`  錯誤: ${error.message}`);
    return { status: "FAIL", error: error.message };
  }
}

async function main() {
  const cell = await setupTestCell();

  try {
    const results = [];

    // 測試案例 1
    const result1 = await testCase1_HelloService(cell);
    results.push({ name: "Case 1: HelloService", ...result1 });

    // 測試案例 2
    const result2 = await testCase2_Calculator(cell);
    results.push({ name: "Case 2: Calculator", ...result2 });

    // 總結
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("測試總結");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    for (const result of results) {
      const symbol = result.status === "PASS" ? "✅" : "❌";
      console.log(`${symbol} ${result.name}: ${result.status}`);
      if (result.artifactId) {
        console.log(`   Artifact: ${result.artifactId}`);
      }
    }

    const passCount = results.filter((r) => r.status === "PASS").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;

    console.log(`\n總計: ${results.length} | 通過: ${passCount} | 失敗: ${failCount}`);

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    // 清理測試 cell
    console.log("\n清理測試環境...");
    await cell.assistant?.cleanup?.();
    await fs.rm(`cells/${CELL_ID}`, { recursive: true, force: true });
    console.log("✓ 清理完成");
  }
}

main().catch((error) => {
  console.error("測試執行失敗:", error);
  process.exit(1);
});
