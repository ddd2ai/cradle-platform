import { createCopilotProvider } from "../src/providers/copilot-provider.js";

const provider = await createCopilotProvider({
  model: "gpt-5-mini",
});

// 檢測 corrupted patterns
function checkCorruption(text) {
  const patterns = [
    "typetype",
    "titletitle",
    "codecode",
    "LibraryLibrary",
    "{{",
    '" "',
    "goalgoal",
    "outputsoutputs",
  ];

  const found = patterns.filter((p) => text.includes(p));
  return { corrupted: found.length > 0, patterns: found };
}

// Test 1: 簡單 JSON
console.log("🧪 Test 1: Simple JSON");
const result1 = await provider.ask({
  prompt: `只輸出以下 JSON,不要解釋:

{
  "type": "code",
  "title": "Test",
  "outputs": []
}`,
});

const check1 = checkCorruption(result1);
console.log(check1.corrupted ? "❌ FAILED" : "✅ PASSED");
if (check1.corrupted) {
  console.log("Corrupted patterns:", check1.patterns);
  console.log("Preview:", result1.substring(0, 300));
}

// Test 2: HelloService (單檔案)
console.log("\n🧪 Test 2: HelloService (單檔案)");
const result2 = await provider.ask({
  prompt: `寫一個 Java class,名稱為 HelloService,包含 sayHello 方法,回傳 Hello Cradle。

請以 JSON 格式輸出:

{
  "type": "code",
  "title": "HelloService",
  "outputs": [
    {
      "type": "java",
      "path": "HelloService.java",
      "content": "..."
    }
  ]
}`,
});

const check2 = checkCorruption(result2);
console.log(check2.corrupted ? "❌ FAILED" : "✅ PASSED");
if (check2.corrupted) {
  console.log("Corrupted patterns:", check2.patterns);
  console.log("Preview:", result2.substring(0, 300));
}

// Test 3: LibraryLoanApp (多檔案)
console.log("\n🧪 Test 3: LibraryLoanApp (多檔案)");
const result3 = await provider.ask({
  prompt: `建立多檔案 Java 可執行小系統 LibraryLoanApp。

請產生:
- Book.java
- Member.java
- Loan.java
- LibraryService.java
- LibraryLoanApp.java (含 main 方法)

只能使用 Java 標準函式庫。

請以 JSON 格式輸出:

{
  "type": "executable-java",
  "title": "LibraryLoanApp",
  "goal": "圖書館借閱系統",
  "outputs": [
    {
      "type": "java",
      "path": "Book.java",
      "content": "..."
    }
  ]
}`,
});

const check3 = checkCorruption(result3);
console.log(check3.corrupted ? "❌ FAILED" : "✅ PASSED");
if (check3.corrupted) {
  console.log("Corrupted patterns:", check3.patterns);
  console.log("Preview:", result3.substring(0, 500));
}

// 最終報告
console.log("\n" + "=".repeat(50));
console.log("📊 Final Report");
console.log("=".repeat(50));

const allPassed = !check1.corrupted && !check2.corrupted && !check3.corrupted;

if (allPassed) {
  console.log("✅ All tests PASSED");
  console.log("Provider streaming is stable!");
  process.exit(0);
} else {
  console.log("❌ Some tests FAILED");
  console.log("Provider streaming needs further investigation");
  process.exit(1);
}
