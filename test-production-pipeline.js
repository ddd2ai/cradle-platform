// test-production-pipeline.js
// 自動化測試 Production Pipeline

import { CradleCell } from "./src/cradle-cell.js";
import fs from "fs/promises";
import path from "path";

const PROVIDER = process.env.PROVIDER || "ollama";
const MODEL = process.env.MODEL || "gemma:7b";

console.log(`\n=== Production Pipeline Test ===`);
console.log(`Provider: ${PROVIDER}`);
console.log(`Model: ${MODEL}\n`);

async function runTests() {
  // 建立測試 cell
  const cell = new CradleCell({
    id: "cell-001",
    name: "Test Cell",
    model: MODEL,
    provider: PROVIDER,
  });

  await cell.prepare();

  console.log(`✓ Cell prepared: ${cell.id}\n`);

// 測試案例
const testCases = [
  {
    name: "Case 1: HelloService Java class",
    type: "code",
    goal: "寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle",
    expectedFile: "HelloService.java",
    expectedContent: ["class HelloService", "sayHello", "Hello Cradle"],
  },
  {
    name: "Case 2: UserProfile Java record",
    type: "code",
    goal: "寫一個 Java record,名稱為 UserProfile,欄位包含 id,name,email",
    expectedFile: "UserProfile.java",
    expectedContent: ["record UserProfile", "id", "name", "email"],
    mustNotContain: ["HelloService"],
  },
  {
    name: "Case 3: GreetingPort Java interface",
    type: "code",
    goal: "寫一個 Java interface,名稱為 GreetingPort,包含 greet(String name) 方法",
    expectedFile: "GreetingPort.java",
    expectedContent: ["interface GreetingPort", "greet", "String name"],
  },
  {
    name: "Case 4: Document artifact",
    type: "document",
    goal: "建立一套電商系統",
    expectedExtension: ".md",
    forbiddenExtensions: [".java", ".sql", ".properties"],
  },
  {
    name: "Case 5: SQL artifact",
    type: "sql",
    goal: "建立電商系統訂單與訂單明細資料表",
    expectedExtension: ".sql",
    expectedContent: ["CREATE TABLE"],
  },
];

const results = [];

for (const testCase of testCases) {
  console.log(`\n─────────────────────────────────────`);
  console.log(`Running: ${testCase.name}`);
  console.log(`Goal: ${testCase.goal}`);
  console.log(`─────────────────────────────────────\n`);

  try {
    const result = await cell.produceArtifact({
      type: testCase.type,
      goal: testCase.goal,
      title: testCase.goal.slice(0, 80),
    });

    const artifact = result.artifact;
    const artifactDir = path.join(cell.productionsDir, artifact.id);

    console.log(`✓ Artifact produced: ${artifact.id}`);
    console.log(`  Type: ${artifact.type}`);
    console.log(`  Title: ${artifact.title}`);
    console.log(`  Outputs: ${artifact.outputs.length}`);

    // 驗證 outputs
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
    };

    for (const output of artifact.outputs) {
      console.log(`  - ${output.path} [${output.language}]`);

      // 檢查檔案是否存在
      const outputPath = path.join(artifactDir, "outputs", output.path);
      try {
        const content = await fs.readFile(outputPath, "utf8");

        // 檢查 expected file name
        if (testCase.expectedFile && !output.path.includes(testCase.expectedFile)) {
          validation.errors.push(`Expected file name ${testCase.expectedFile}, got ${output.path}`);
          validation.passed = false;
        }

        // 檢查 expected content
        if (testCase.expectedContent) {
          for (const expected of testCase.expectedContent) {
            if (!content.includes(expected)) {
              validation.errors.push(`Missing expected content: ${expected}`);
              validation.passed = false;
            }
          }
        }

        // 檢查 must not contain
        if (testCase.mustNotContain) {
          for (const forbidden of testCase.mustNotContain) {
            if (content.includes(forbidden)) {
              validation.errors.push(`Content must not contain: ${forbidden}`);
              validation.passed = false;
            }
          }
        }

        // 檢查 code fence
        if (content.includes("```")) {
          validation.errors.push(`Content contains markdown code fence`);
          validation.passed = false;
        }

        // 檢查 extension
        if (testCase.expectedExtension && !output.path.endsWith(testCase.expectedExtension)) {
          validation.errors.push(`Expected extension ${testCase.expectedExtension}, got ${output.path}`);
          validation.passed = false;
        }

        if (testCase.forbiddenExtensions) {
          for (const forbidden of testCase.forbiddenExtensions) {
            if (output.path.endsWith(forbidden)) {
              validation.errors.push(`Forbidden extension: ${forbidden}`);
              validation.passed = false;
            }
          }
        }

      } catch (error) {
        validation.errors.push(`Failed to read output file: ${error.message}`);
        validation.passed = false;
      }
    }

    results.push({
      name: testCase.name,
      passed: validation.passed,
      artifactId: artifact.id,
      outputs: artifact.outputs.map((o) => o.path),
      errors: validation.errors,
      warnings: validation.warnings,
    });

    if (validation.passed) {
      console.log(`\n✓ ${testCase.name} PASSED`);
    } else {
      console.log(`\n✗ ${testCase.name} FAILED`);
      for (const error of validation.errors) {
        console.log(`  - ${error}`);
      }
    }

  } catch (error) {
    console.log(`\n✗ ${testCase.name} FAILED`);
    console.log(`  Error: ${error.message}`);

    results.push({
      name: testCase.name,
      passed: false,
      error: error.message,
      stack: error.stack,
    });
  }
}

// 輸出測試報告
console.log(`\n\n═══════════════════════════════════════`);
console.log(`        Test Results Summary`);
console.log(`═══════════════════════════════════════\n`);

console.log(`Provider: ${PROVIDER}`);
console.log(`Model: ${MODEL}\n`);

let passCount = 0;
let failCount = 0;

for (const result of results) {
  const status = result.passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status} - ${result.name}`);

  if (result.passed) {
    passCount++;
    console.log(`  Artifact ID: ${result.artifactId}`);
    console.log(`  Outputs: ${result.outputs.join(", ")}`);
  } else {
    failCount++;
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.errors?.length > 0) {
      console.log(`  Validation errors:`);
      for (const error of result.errors) {
        console.log(`    - ${error}`);
      }
    }
  }
  console.log();
}

console.log(`═══════════════════════════════════════`);
console.log(`Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`);
console.log(`═══════════════════════════════════════\n`);

  return failCount;
}

// 執行測試
runTests()
  .then((failCount) => {
    process.exit(failCount > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Test execution failed:", error);
    process.exit(1);
  });
