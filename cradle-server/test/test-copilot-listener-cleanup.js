/**
 * Test Copilot Provider Listener Cleanup
 *
 * 驗證：
 * 1. 舊 listener 不會繼續收到新請求的事件
 * 2. closed guard 能防止舊 callback 執行
 * 3. 連續多個請求時，只有當前請求的 listener 在工作
 */

import { createCopilotProvider } from "../src/providers/copilot-provider.js";

async function testListenerCleanup() {
  console.log("\n=== Copilot Listener Cleanup Test ===\n");

  const provider = await createCopilotProvider({
    model: "gpt-5-mini",
    cliUrl: "http://localhost:4321",
  });

  // 追蹤每個請求收到的事件
  const eventLog = [];

  // Test 1: 第一個請求
  console.log("Test 1: First Request");
  console.log("---------------------");

  let test1DeltaCount = 0;
  let test1Buffer = "";

  const response1 = await provider.ask({
    prompt: "Say hello",
    onDelta: (chunk) => {
      test1DeltaCount++;
      test1Buffer += chunk;
      eventLog.push({
        test: 1,
        type: "delta",
        timestamp: Date.now(),
        chunk,
      });
    },
    onIdle: () => {
      eventLog.push({
        test: 1,
        type: "idle",
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      eventLog.push({
        test: 1,
        type: "error",
        timestamp: Date.now(),
        error,
      });
    },
  });

  console.log(`Response 1     : ${response1.slice(0, 50)}...`);
  console.log(`Delta Count 1  : ${test1DeltaCount}`);
  console.log(`Buffer Length 1: ${test1Buffer.length}`);
  console.log("");

  // 等待一下，確保第一個請求完全清理
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Test 2: 第二個請求
  console.log("Test 2: Second Request");
  console.log("----------------------");

  let test2DeltaCount = 0;
  let test2Buffer = "";

  const response2 = await provider.ask({
    prompt: "Say goodbye",
    onDelta: (chunk) => {
      test2DeltaCount++;
      test2Buffer += chunk;
      eventLog.push({
        test: 2,
        type: "delta",
        timestamp: Date.now(),
        chunk,
      });
    },
    onIdle: () => {
      eventLog.push({
        test: 2,
        type: "idle",
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      eventLog.push({
        test: 2,
        type: "error",
        timestamp: Date.now(),
        error,
      });
    },
  });

  console.log(`Response 2     : ${response2.slice(0, 50)}...`);
  console.log(`Delta Count 2  : ${test2DeltaCount}`);
  console.log(`Buffer Length 2: ${test2Buffer.length}`);
  console.log("");

  // 等待一下
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Test 3: 第三個請求
  console.log("Test 3: Third Request");
  console.log("---------------------");

  let test3DeltaCount = 0;
  let test3Buffer = "";

  const response3 = await provider.ask({
    prompt: "Count to 3",
    onDelta: (chunk) => {
      test3DeltaCount++;
      test3Buffer += chunk;
      eventLog.push({
        test: 3,
        type: "delta",
        timestamp: Date.now(),
        chunk,
      });
    },
    onIdle: () => {
      eventLog.push({
        test: 3,
        type: "idle",
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      eventLog.push({
        test: 3,
        type: "error",
        timestamp: Date.now(),
        error,
      });
    },
  });

  console.log(`Response 3     : ${response3.slice(0, 50)}...`);
  console.log(`Delta Count 3  : ${test3DeltaCount}`);
  console.log(`Buffer Length 3: ${test3Buffer.length}`);
  console.log("");

  // Test 4: 驗證事件隔離
  console.log("Test 4: Event Isolation Validation");
  console.log("-----------------------------------");

  // 計算每個 test 收到的事件數
  const test1Events = eventLog.filter((e) => e.test === 1).length;
  const test2Events = eventLog.filter((e) => e.test === 2).length;
  const test3Events = eventLog.filter((e) => e.test === 3).length;

  console.log(`Test 1 Events  : ${test1Events}`);
  console.log(`Test 2 Events  : ${test2Events}`);
  console.log(`Test 3 Events  : ${test3Events}`);
  console.log(`Total Events   : ${eventLog.length}`);
  console.log("");

  // 驗證：Test 1 的事件應該只在 Test 1 期間發生
  const test1EndTime = eventLog
    .filter((e) => e.test === 1)
    .reduce((max, e) => Math.max(max, e.timestamp), 0);

  const test2StartTime = eventLog
    .filter((e) => e.test === 2)
    .reduce((min, e) => Math.min(min, e.timestamp), Infinity);

  // 檢查是否有 Test 1 的事件在 Test 2 開始後還在發生
  const test1LeakedToTest2 = eventLog.some(
    (e) => e.test === 1 && e.timestamp >= test2StartTime
  );

  const test1LeakedToTest3 = eventLog.some(
    (e) =>
      e.test === 1 &&
      e.timestamp >=
        eventLog
          .filter((e) => e.test === 3)
          .reduce((min, e) => Math.min(min, e.timestamp), Infinity)
  );

  const test2LeakedToTest3 = eventLog.some(
    (e) =>
      e.test === 2 &&
      e.timestamp >=
        eventLog
          .filter((e) => e.test === 3)
          .reduce((min, e) => Math.min(min, e.timestamp), Infinity)
  );

  console.log("Leak Detection:");
  console.log(`  Test 1 → Test 2: ${test1LeakedToTest2 ? "❌ LEAKED" : "✓ Clean"}`);
  console.log(`  Test 1 → Test 3: ${test1LeakedToTest3 ? "❌ LEAKED" : "✓ Clean"}`);
  console.log(`  Test 2 → Test 3: ${test2LeakedToTest3 ? "❌ LEAKED" : "✓ Clean"}`);
  console.log("");

  // Test 5: Buffer 完整性
  console.log("Test 5: Buffer Integrity");
  console.log("------------------------");

  const buffer1Match = test1Buffer === response1;
  const buffer2Match = test2Buffer === response2;
  const buffer3Match = test3Buffer === response3;

  console.log(`Buffer 1 Match : ${buffer1Match ? "✓" : "❌"}`);
  console.log(`Buffer 2 Match : ${buffer2Match ? "✓" : "❌"}`);
  console.log(`Buffer 3 Match : ${buffer3Match ? "✓" : "❌"}`);
  console.log("");

  // Test 6: 無重複內容檢測
  console.log("Test 6: Duplication Detection");
  console.log("-----------------------------");

  const hasDuplication1 = response1.includes("HelloHello") || response1.includes("{{");
  const hasDuplication2 = response2.includes("GoodbyeGoodbye") || response2.includes("{{");
  const hasDuplication3 = response3.includes("11") || response3.includes("{{");

  console.log(`Response 1 Clean: ${hasDuplication1 ? "❌" : "✓"}`);
  console.log(`Response 2 Clean: ${hasDuplication2 ? "❌" : "✓"}`);
  console.log(`Response 3 Clean: ${hasDuplication3 ? "❌" : "✓"}`);
  console.log("");

  // Final Summary
  console.log("=== Summary ===");
  console.log("");

  const allTestsPassed =
    !test1LeakedToTest2 &&
    !test1LeakedToTest3 &&
    !test2LeakedToTest3 &&
    buffer1Match &&
    buffer2Match &&
    buffer3Match &&
    !hasDuplication1 &&
    !hasDuplication2 &&
    !hasDuplication3;

  if (allTestsPassed) {
    console.log("✓ All tests passed!");
    console.log("✓ Listener cleanup is working correctly");
    console.log("✓ No event leakage detected");
    console.log("✓ Buffer integrity maintained");
  } else {
    console.log("❌ Some tests failed");

    if (test1LeakedToTest2 || test1LeakedToTest3 || test2LeakedToTest3) {
      console.log("❌ Event leakage detected - old listeners still active");
    }

    if (!buffer1Match || !buffer2Match || !buffer3Match) {
      console.log("❌ Buffer mismatch - streaming not working correctly");
    }

    if (hasDuplication1 || hasDuplication2 || hasDuplication3) {
      console.log("❌ Duplicated content detected");
    }
  }

  console.log("");

  await provider.cleanup();
}

testListenerCleanup().catch((error) => {
  console.error(error);
  process.exit(1);
});
